#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SITE_DIR = path.join(__dirname, "site");
const POSTS_DIR = path.join(SITE_DIR, "posts");
const PAGE_DIR = path.join(SITE_DIR, "page");
const FEED_PATH = path.join(SITE_DIR, "feed.xml");
const INDEX_PATH = path.join(SITE_DIR, "index.html");
const POSTS_PER_PAGE = 10;

// --- CLI ---

function printUsage() {
  console.log("Usage:");
  console.log('  node publish.js "Post Title" content.md');
  console.log(
    "  node publish.js content.md              (title from first # heading or filename)",
  );
  console.log("");
  console.log("Options:");
  console.log("  --dry-run    Show what would happen without making changes");
  console.log("  --no-push    Commit but don't push");
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { dryRun: false, noPush: false };
  const positional = [];

  for (const arg of args) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--no-push") flags.noPush = true;
    else if (arg === "--help" || arg === "-h") printUsage();
    else positional.push(arg);
  }

  if (positional.length === 0) printUsage();

  let title, mdFile;
  if (positional.length === 1) {
    mdFile = positional[0];
    title = null; // will extract from content
  } else {
    title = positional[0];
    mdFile = positional[1];
  }

  if (!fs.existsSync(mdFile)) {
    console.error(`Error: File not found: ${mdFile}`);
    process.exit(1);
  }

  return { title, mdFile, flags };
}

// --- Markdown to HTML ---

function markdownToHtml(md) {
  const blocks = md.split(/\n\n+/).filter((b) => b.trim());

  return blocks
    .map((block) => {
      let html = block.trim();

      // Convert single newlines to <br>\n
      html = html.replace(/\n/g, "<br>\n");

      // Bold: **text** or __text__
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

      // Italic: *text* or _text_ (but not inside **)
      html = html.replace(
        /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
        "<em>$1</em>",
      );
      html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");

      // Links: [text](url)
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      return `<p>${html}</p>`;
    })
    .join("\n\n");
}

function extractTitle(md) {
  const match = md.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return null;
}

function removeTitleFromContent(md) {
  return md.replace(/^#\s+.+\n*/, "").trim();
}

// --- Slug ---

function slugify(title) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .trim()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-"); // collapse hyphens
}

// --- Excerpt ---

function generateExcerpt(md, maxLen = 280) {
  let text = md
    .replace(/^#\s+.+\n*/m, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLen) return text;

  const cut = text.lastIndexOf(" ", maxLen);
  return text.substring(0, cut > 0 ? cut : maxLen) + "\u2026";
}

// --- Post HTML Template ---

function generatePostHtml(title, contentHtml, date) {
  const dateStr = formatDateISO(date);
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} \u2013 rascunhos</title>
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="../feed.xml">
</head>
<body>
  <!-- Post date stored but not displayed: ${dateStr} -->
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <div class="menu-icon"><span></span></div>
        <a href="../index.html" class="site-title">rascunhos</a>
      </nav>
    </aside>

    <main class="main-content">
      <article class="post-content" data-date="${dateStr}">
        <h1>${escapeHtml(title)}</h1>

${contentHtml}

      </article>
    </main>
  </div>

  <!-- Floating Subscribe Button -->
  <div class="subscribe-float">
    <a href="https://buttondown.email/hhmacedo" target="_blank" class="subscribe-float-link">
      <button type="button">Subscribe</button>
    </a>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <h2 class="footer-title">rascunhos</h2>
      <p class="footer-tagline">uns v\u00e3o para o lixo, outros nem por isso</p>

      <div class="footer-subscribe">
        <form action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui..." required>
          <button type="submit">subscrever</button>
        </form>
      </div>

      <div class="footer-bottom">
        <a href="../o-culpado/">autor</a>
      </div>
    </div>
  </footer>
<!-- GoatCounter Analytics -->
<script data-goatcounter="https://rascunhos.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;
}

// --- Index & Pagination ---

function parsePostItems(html) {
  const items = [];
  const regex =
    /<li class="post-item" data-date="([^"]+)">\s*<h2 class="post-title">\s*<a href="[^"]*\/?(posts\/[^"]+)">([^<]+)<\/a>\s*<\/h2>\s*<p class="post-excerpt">\s*([\s\S]*?)<a href="[^"]*" class="read-more">ler mais<\/a>\s*<\/p>\s*<\/li>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    items.push({
      date: match[1],
      file: match[2],
      title: match[3].trim(),
      excerpt: match[4].trim(),
    });
  }
  return items;
}

function collectAllPosts() {
  const posts = [];

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf-8");
  posts.push(...parsePostItems(indexHtml));

  if (fs.existsSync(PAGE_DIR)) {
    const pages = fs
      .readdirSync(PAGE_DIR)
      .filter((f) => f.match(/^\d+\.html$/))
      .sort((a, b) => parseInt(a) - parseInt(b));

    for (const page of pages) {
      const pageHtml = fs.readFileSync(path.join(PAGE_DIR, page), "utf-8");
      posts.push(...parsePostItems(pageHtml));
    }
  }

  return posts;
}

function generatePostItemHtml(post, pathPrefix) {
  const href = `${pathPrefix}${post.file}`;
  return `        <!-- Post -->
        <li class="post-item" data-date="${post.date}">
          <h2 class="post-title">
            <a href="${href}">${post.title}</a>
          </h2>
          <p class="post-excerpt">
            ${post.excerpt} <a href="${href}" class="read-more">ler mais</a>
          </p>
        </li>`;
}

function generatePaginationHtml(currentPage, totalPages, isIndex) {
  const parts = [];

  if (currentPage > 1) {
    const prevHref =
      currentPage === 2
        ? isIndex
          ? "index.html"
          : "../index.html"
        : isIndex
          ? `page/${currentPage - 1}.html`
          : `${currentPage - 1}.html`;
    parts.push(`        <a href="${prevHref}">P\u00e1gina anterior</a>`);
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      parts.push(`        <span class="current">${i}</span>`);
    } else {
      let href;
      if (i === 1) {
        href = isIndex ? "index.html" : "../index.html";
      } else {
        href = isIndex ? `page/${i}.html` : `${i}.html`;
      }
      parts.push(`        <a href="${href}">${i}</a>`);
    }
  }

  if (currentPage < totalPages) {
    const nextHref = isIndex
      ? `page/${currentPage + 1}.html`
      : `${currentPage + 1}.html`;
    parts.push(`        <a href="${nextHref}">P\u00e1gina seguinte</a>`);
  }

  return `      <!-- Pagination -->
      <nav class="pagination">
${parts.join("\n")}
      </nav>`;
}

function generateIndexPage(posts, currentPage, totalPages) {
  const isIndex = currentPage === 1;
  const pathPrefix = isIndex ? "" : "../";
  const titleSuffix = isIndex
    ? " \u2013 porque a escrita nunca termina, porque fica sempre algo por dizer, por emendar,\u2026 ou talvez n\u00e3o."
    : ` \u2013 P\u00e1gina ${currentPage}`;

  const postListHtml = posts
    .map((p) => generatePostItemHtml(p, pathPrefix))
    .join("\n\n");

  const paginationHtml =
    totalPages > 1
      ? "\n\n" + generatePaginationHtml(currentPage, totalPages, isIndex)
      : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rascunhos${titleSuffix}</title>
  <link rel="stylesheet" href="${pathPrefix}css/styles.css">
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="${pathPrefix}feed.xml">
</head>
<body>
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <div class="menu-icon"><span></span></div>
        <a href="${pathPrefix}index.html" class="site-title">rascunhos</a>
      </nav>
    </aside>

    <main class="main-content">
      <ul class="post-list">
${postListHtml}
      </ul>
${paginationHtml}
    </main>
  </div>

  <!-- Floating Subscribe Button -->
  <div class="subscribe-float">
    <a href="https://buttondown.email/hhmacedo" target="_blank" class="subscribe-float-link">
      <button type="button">Subscribe</button>
    </a>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <h2 class="footer-title">rascunhos</h2>
      <p class="footer-tagline">uns v\u00e3o para o lixo, outros nem por isso</p>

      <div class="footer-subscribe">
        <form action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui..." required>
          <button type="submit">subscrever</button>
        </form>
      </div>

      <div class="footer-bottom">
        <a href="${pathPrefix}o-culpado/">autor</a>
      </div>
    </div>
  </footer>
<!-- GoatCounter Analytics -->
<script data-goatcounter="https://rascunhos.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;
}

// --- RSS Feed ---

function generateRssItem(title, slug, date, excerpt) {
  const url = `https://rascunhos.blog/posts/${slug}.html`;
  const pubDate = date.toUTCString();
  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${excerpt}]]></description>
    </item>`;
}

function updateFeed(title, slug, date, excerpt) {
  let feed = fs.readFileSync(FEED_PATH, "utf-8");

  const newBuildDate = date.toUTCString();
  feed = feed.replace(
    /<lastBuildDate>[^<]+<\/lastBuildDate>/,
    `<lastBuildDate>${newBuildDate}</lastBuildDate>`,
  );

  const newItem = generateRssItem(title, slug, date, excerpt);
  feed = feed.replace(/(<atom:link[^>]*\/>)\s*\n/, `$1\n\n${newItem}\n\n`);

  return feed;
}

// --- Utilities ---

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateISO(date) {
  return date.toISOString().split("T")[0];
}

// --- Main ---

function main() {
  const { title: cliTitle, mdFile, flags } = parseArgs();
  const md = fs.readFileSync(mdFile, "utf-8");
  const now = new Date();

  let title = cliTitle || extractTitle(md) || path.basename(mdFile, ".md");
  const content = cliTitle ? md : removeTitleFromContent(md);

  const slug = slugify(title);
  const postFile = `${slug}.html`;
  const postPath = path.join(POSTS_DIR, postFile);

  if (fs.existsSync(postPath)) {
    console.error(`Error: Post already exists: ${postPath}`);
    console.error("If you want to update it, edit the HTML directly.");
    process.exit(1);
  }

  const contentHtml = markdownToHtml(content);
  const excerpt = generateExcerpt(md);
  const postHtml = generatePostHtml(title, contentHtml, now);

  console.log(`Publishing: "${title}"`);
  console.log(`  Slug: ${slug}`);
  console.log(`  File: site/posts/${postFile}`);
  console.log(`  Date: ${formatDateISO(now)}`);
  console.log(`  Excerpt: ${excerpt.substring(0, 80)}...`);
  console.log("");

  if (flags.dryRun) {
    console.log("[DRY RUN] No files changed.");
    return;
  }

  // 1. Create post file
  fs.writeFileSync(postPath, postHtml);
  console.log(`  Created: site/posts/${postFile}`);

  // 2. Collect all existing posts and prepend the new one
  const allPosts = collectAllPosts();
  const newPost = {
    date: formatDateISO(now),
    file: `posts/${postFile}`,
    title: title,
    excerpt: excerpt,
  };
  allPosts.unshift(newPost);

  // 3. Paginate
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const changedFiles = [`site/posts/${postFile}`];

  // Write index.html (page 1)
  const page1Posts = allPosts.slice(0, POSTS_PER_PAGE);
  fs.writeFileSync(INDEX_PATH, generateIndexPage(page1Posts, 1, totalPages));
  changedFiles.push("site/index.html");
  console.log("  Updated: site/index.html");

  // Write pagination pages
  if (!fs.existsSync(PAGE_DIR)) fs.mkdirSync(PAGE_DIR, { recursive: true });

  for (let p = 2; p <= totalPages; p++) {
    const start = (p - 1) * POSTS_PER_PAGE;
    const pagePosts = allPosts.slice(start, start + POSTS_PER_PAGE);
    const pagePath = path.join(PAGE_DIR, `${p}.html`);
    fs.writeFileSync(pagePath, generateIndexPage(pagePosts, p, totalPages));
    changedFiles.push(`site/page/${p}.html`);
    console.log(`  Updated: site/page/${p}.html`);
  }

  // Remove old pagination pages no longer needed
  if (fs.existsSync(PAGE_DIR)) {
    const existingPages = fs
      .readdirSync(PAGE_DIR)
      .filter((f) => f.match(/^\d+\.html$/));
    for (const page of existingPages) {
      const pageNum = parseInt(page);
      if (pageNum > totalPages) {
        fs.unlinkSync(path.join(PAGE_DIR, page));
        console.log(`  Removed: site/page/${page}`);
      }
    }
  }

  // 4. Update RSS feed
  const updatedFeed = updateFeed(title, slug, now, excerpt);
  fs.writeFileSync(FEED_PATH, updatedFeed);
  changedFiles.push("site/feed.xml");
  console.log("  Updated: site/feed.xml");

  // 5. Git commit & push
  console.log("");
  try {
    execFileSync("git", ["add", ...changedFiles], {
      cwd: __dirname,
      stdio: "pipe",
    });
    execFileSync("git", ["commit", "-m", `Publish: ${title}`], {
      cwd: __dirname,
      stdio: "pipe",
    });
    console.log(`  Committed: "Publish: ${title}"`);

    if (!flags.noPush) {
      execFileSync("git", ["push"], { cwd: __dirname, stdio: "pipe" });
      console.log("  Pushed to remote.");
    }
  } catch (err) {
    console.error("  Git error:", err.message);
    console.error("  Files were created/updated but not committed.");
  }

  console.log("");
  console.log(`Done! Post live at: https://rascunhos.blog/posts/${postFile}`);
}

main();
