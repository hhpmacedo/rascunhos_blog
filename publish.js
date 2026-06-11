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
// Homepage rhythm (option A): 1 featured + N recent (full excerpts) + archive
// (one-line entries). Posts only ever move *down* this hierarchy as newer ones
// are prepended, so an archive line never needs to expand back into an excerpt.
const RECENT_COUNT = 2;
const ARCHIVE_LINE_LEN = 78;

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
  // Ensure headings and horizontal rules are separated into their own blocks
  md = md.replace(/^(#{1,4}\s+.+)$/gm, "\n\n$1\n\n");
  md = md.replace(/^([-*_]{3,})$/gm, "\n\n$1\n\n");

  const blocks = md.split(/\n\n+/).filter((b) => b.trim());

  return blocks
    .map((block) => {
      let html = block.trim();

      // Section break: --- or *** or ___ renders as an ⁂ asterism (v2 design)
      if (/^[-*_]{3,}$/.test(html)) {
        return '<p class="asterism">⁂</p>';
      }

      // Headings: # text renders as h2, ## as h3, ### as h4 (h1 is the post title)
      const headingMatch = html.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length + 1, 4);
        return `<h${level}>${headingMatch[2]}</h${level}>`;
      }

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
  const match = md.match(/^\s*#\s+(.+)$/m);
  if (match) return match[1].trim();
  return null;
}

function removeTitleFromContent(md) {
  return md.replace(/^\s*#\s+.+\n*/, "").trim();
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
    .replace(/^#{1,4}\s+.+$/gm, "") // strip all headings
    .replace(/^[-*_]{3,}$/gm, "") // strip horizontal rules
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

// One side of the anterior/seguinte nav (or an empty spacer to keep the
// remaining link aligned). Titles use the post's display title, like the index.
function postNavLink(post, cls, label) {
  const href = post.file.replace(/^posts\//, "");
  return `        <a href="${href}" class="${cls}">
          <p class="post-nav-label">${label}</p>
          <p class="post-nav-title">${post.title}</p>
        </a>`;
}

// Inner of <nav class="post-nav">: anterior (older) on the left, seguinte
// (newer) on the right. A missing neighbour becomes an empty <span> spacer.
function generatePostNavInner(anterior, seguinte) {
  const left = anterior
    ? postNavLink(anterior, "prev-post", "\u2190 anterior")
    : "        <span></span>";
  const right = seguinte
    ? postNavLink(seguinte, "next-post", "seguinte \u2192")
    : "        <span></span>";
  return `${left}\n${right}`;
}

// Rewrite a neighbour post's nav in place (used when a newer post is published,
// so the previously-newest post gains its "seguinte \u2192" link). Returns the
// repo-relative path if it changed, else null.
function regenerateNeighborNav(neighbor, anterior, seguinte) {
  const rel = neighbor.file.replace(/^posts\//, "");
  const file = path.join(POSTS_DIR, rel);
  if (!fs.existsSync(file)) return null;
  let html = fs.readFileSync(file, "utf-8");
  if (!/<nav class="post-nav">/.test(html)) return null; // not yet migrated
  const navBlock = `<nav class="post-nav">
${generatePostNavInner(anterior, seguinte)}
      </nav>`;
  html = html.replace(/<nav class="post-nav">[\s\S]*?<\/nav>/, navBlock);
  fs.writeFileSync(file, html);
  return `site/posts/${rel}`;
}

// v2 single-post page. `anterior` is the previously-newest post (or null for the
// very first post); a freshly published post is the newest, so it has no seguinte.
function generatePostHtml(title, contentHtml, date, anterior) {
  const dateStr = formatDateISO(date);
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} \u2013 rascunhos</title>
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="../feed.xml">
</head>
<body>
  <!-- Post date stored but not displayed: ${dateStr} -->
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <a href="../index.html" class="site-title">rascunhos</a>
      </nav>
    </aside>

    <main class="main-content">
      <article class="post-content" data-date="${dateStr}">
        <h1>${escapeHtml(title)}</h1>

${contentHtml}

        <p class="post-end">\u2014 fim \u2014</p>
      </article>

      <nav class="post-nav">
${generatePostNavInner(anterior, null)}
      </nav>

      <div class="post-subscribe">
        <p>Se este rascunho te disse algo, os pr\u00f3ximos chegam por email.</p>
        <form class="uform" action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui\u2026" required="required" />
          <button type="submit">subscrever</button>
        </form>
      </div>
    </main>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <h2 class="footer-title">rascunhos</h2>
      <p class="footer-tagline">uns v\u00e3o para o lixo, outros nem por isso</p>

      <p class="footer-note">Os novos rascunhos chegam por email, sem pressa nem prazos.</p>
      <div class="footer-subscribe">
        <form class="uform" action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui\u2026" required="required" />
          <button type="submit">subscrever</button>
        </form>
      </div>

      <div class="footer-bottom">
        <a href="../index.html">in\u00edcio</a>
        <a href="../o-culpado/">autor</a>
        <a href="../feed.xml">rss</a>
        <span class="right">rascunhos.blog</span>
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

function collapse(str) {
  return str.replace(/\s+/g, " ").trim();
}

// Note: these regexes use `"\s*>` (not `">`) at tag boundaries and `</tag\s*>`
// at closes, so they survive Prettier reflow that breaks long opening tags
// across lines (e.g. `<a href="…"\n  >title</a\n>`). Without this tolerance a
// reformatted file would silently drop posts.

// Standard "recent" entry (also the legacy flat-list format on old pages).
function parsePostItems(html) {
  const regex =
    /<li class="post-item" data-date="([^"]+)"\s*>\s*<h2 class="post-title"\s*>\s*<a href="[^"]*\/?(posts\/[^"]+)"\s*>([^<]+)<\/a\s*>\s*<\/h2\s*>\s*<p class="post-excerpt"\s*>\s*([\s\S]*?)<a href="[^"]*" class="read-more"\s*>ler mais<\/a\s*>\s*<\/p\s*>\s*<\/li\s*>/g;
  return [...html.matchAll(regex)].map((m) => ({
    date: m[1],
    file: m[2],
    title: collapse(m[3]),
    excerpt: collapse(m[4]),
  }));
}

// The single featured post at the top of the homepage.
function parseFeaturedItem(html) {
  const regex =
    /<section class="post-featured" data-date="([^"]+)"\s*>[\s\S]*?<h2 class="post-title-featured"\s*>\s*<a href="[^"]*\/?(posts\/[^"]+)"\s*>([^<]+)<\/a\s*>\s*<\/h2\s*>\s*<p class="post-excerpt-featured"\s*>\s*([\s\S]*?)<a href="[^"]*" class="read-more"\s*>ler mais<\/a\s*>/;
  const m = html.match(regex);
  if (!m) return null;
  return {
    date: m[1],
    file: m[2],
    title: collapse(m[3]),
    excerpt: collapse(m[4]),
  };
}

// One-line archive entries (homepage "mais rascunhos" + standalone pages).
function parseArchiveItems(html) {
  const regex =
    /<li data-date="([^"]+)"\s*>\s*<a href="[^"]*\/?(posts\/[^"]+)"\s*>\s*<span class="archive-item"\s*>\s*<span class="archive-title"\s*>([^<]+)<\/span\s*>\s*<span class="archive-line"\s*>\s*([\s\S]*?)<\/span\s*>/g;
  return [...html.matchAll(regex)].map((m) => ({
    date: m[1],
    file: m[2],
    title: collapse(m[3]),
    line: collapse(m[4]),
  }));
}

// Collect every listed post, newest first. Each file is one of two layouts:
// the homepage (featured + recent + archive, in document order) or a plain
// page (recent-style or archive-style). The parsers are disjoint by class, so
// running all three over a file and concatenating preserves chronology.
function collectAllPosts() {
  const posts = [];

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf-8");
  const featured = parseFeaturedItem(indexHtml);
  if (featured) posts.push(featured);
  posts.push(...parsePostItems(indexHtml));
  posts.push(...parseArchiveItems(indexHtml));

  if (fs.existsSync(PAGE_DIR)) {
    const pages = fs
      .readdirSync(PAGE_DIR)
      .filter((f) => f.match(/^\d+\.html$/))
      .sort((a, b) => parseInt(a) - parseInt(b));

    for (const page of pages) {
      const pageHtml = fs.readFileSync(path.join(PAGE_DIR, page), "utf-8");
      posts.push(...parsePostItems(pageHtml));
      posts.push(...parseArchiveItems(pageHtml));
    }
  }

  return posts;
}

// An archive line is either a stored short line, or the head of a full excerpt
// truncated at a word boundary. (Posts only move down, so we never need to
// reconstruct a full excerpt from a short line.)
function archiveLineFrom(post) {
  if (post.line) return post.line;
  const text = collapse(post.excerpt || "");
  if (text.length <= ARCHIVE_LINE_LEN) return text;
  const cut = text.lastIndexOf(" ", ARCHIVE_LINE_LEN);
  return text.slice(0, cut > 0 ? cut : ARCHIVE_LINE_LEN) + "…";
}

// Featured post block (homepage top): large title + full excerpt.
function generateFeaturedHtml(post, pathPrefix) {
  const href = `${pathPrefix}${post.file}`;
  return `        <!-- Featured: latest post -->
        <section class="post-featured" data-date="${post.date}">
          <p class="kicker">o mais recente</p>
          <h2 class="post-title-featured">
            <a href="${href}">${post.title}</a>
          </h2>
          <p class="post-excerpt-featured">
            ${post.excerpt} <a href="${href}" class="read-more">ler mais</a>
          </p>
        </section>`;
}

// Standard "recent" list entry: medium title + full excerpt.
function generatePostItemHtml(post, pathPrefix) {
  const href = `${pathPrefix}${post.file}`;
  return `          <li class="post-item" data-date="${post.date}">
            <h2 class="post-title">
              <a href="${href}">${post.title}</a>
            </h2>
            <p class="post-excerpt">
              ${post.excerpt} <a href="${href}" class="read-more">ler mais</a>
            </p>
          </li>`;
}

// One-line archive entry: bold title + italic teaser line.
function generateArchiveItemHtml(post, pathPrefix) {
  const href = `${pathPrefix}${post.file}`;
  return `            <li data-date="${post.date}">
              <a href="${href}">
                <span class="archive-item">
                  <span class="archive-title">${post.title}</span>
                  <span class="archive-line">${archiveLineFrom(post)}</span>
                </span>
              </a>
            </li>`;
}

// Shared footer (evolved design): wordmark, quiet note, typographic
// underline form, and footer-only navigation.
function generateFooterHtml(pathPrefix) {
  return `  <footer class="site-footer">
    <div class="footer-content">
      <h2 class="footer-title">rascunhos</h2>
      <p class="footer-tagline">uns v\u00e3o para o lixo, outros nem por isso</p>

      <p class="footer-note">Os novos rascunhos chegam por email, sem pressa nem prazos.</p>
      <div class="footer-subscribe">
        <form class="uform" action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui\u2026" required="required" />
          <button type="submit">subscrever</button>
        </form>
      </div>

      <div class="footer-bottom">
        <a href="${pathPrefix}o-culpado/">autor</a>
        <a href="https://buttondown.email/hhmacedo" target="_blank">subscrever</a>
        <a href="${pathPrefix}feed.xml">rss</a>
        <span class="right">rascunhos.blog</span>
      </div>
    </div>
  </footer>`;
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
    parts.push(`        <a href="${prevHref}">\u2190 p\u00e1gina anterior</a>`);
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
    parts.push(
      `        <a href="${nextHref}" class="next">p\u00e1gina seguinte \u2192</a>`,
    );
  }

  return `      <!-- Pagination -->
      <nav class="pagination">
${parts.join("\n")}
      </nav>`;
}

// Build the body of <main> for a given page of posts.
//   Page 1 (homepage): 1 featured + RECENT_COUNT recent + the rest as archive.
//   Pages 2+: a plain archive list of everything on the page.
function generateMainContent(posts, isIndex) {
  if (!isIndex) {
    const archiveHtml = posts
      .map((p) => generateArchiveItemHtml(p, "../"))
      .join("\n");
    return `        <section class="post-archive">
          <p class="kicker">mais rascunhos</p>
          <ul>
${archiveHtml}
          </ul>
        </section>`;
  }

  const featured = posts[0];
  const recent = posts.slice(1, 1 + RECENT_COUNT);
  const archive = posts.slice(1 + RECENT_COUNT);
  const blocks = [];

  if (featured) blocks.push(generateFeaturedHtml(featured, ""));

  if (recent.length) {
    const recentHtml = recent
      .map((p) => generatePostItemHtml(p, ""))
      .join("\n\n");
    blocks.push(`        <!-- Recent posts -->
        <ul class="post-list">
${recentHtml}
        </ul>`);
  }

  if (archive.length) {
    const archiveHtml = archive
      .map((p) => generateArchiveItemHtml(p, ""))
      .join("\n");
    blocks.push(`        <!-- Archive: older posts, one line each -->
        <section class="post-archive">
          <p class="kicker">mais rascunhos</p>
          <ul>
${archiveHtml}
          </ul>
        </section>`);
  }

  return blocks.join("\n\n");
}

function generateIndexPage(posts, currentPage, totalPages) {
  const isIndex = currentPage === 1;
  const pathPrefix = isIndex ? "" : "../";
  const titleSuffix = isIndex
    ? " \u2013 porque a escrita nunca termina, porque fica sempre algo por dizer, por emendar,\u2026 ou talvez n\u00e3o."
    : ` \u2013 P\u00e1gina ${currentPage}`;

  const mainContent = generateMainContent(posts, isIndex);

  const paginationHtml =
    totalPages > 1
      ? "\n\n" + generatePaginationHtml(currentPage, totalPages, isIndex)
      : "";

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>rascunhos${titleSuffix}</title>
  <link rel="stylesheet" href="${pathPrefix}css/styles.css" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="${pathPrefix}feed.xml" />
</head>
<body>
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <a href="${pathPrefix}index.html" class="site-title">rascunhos</a>
      </nav>
    </aside>

    <main class="main-content">
${mainContent}${paginationHtml}
    </main>
  </div>

${generateFooterHtml(pathPrefix)}

  <!-- GoatCounter Analytics -->
  <script data-goatcounter="https://rascunhos.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
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

  console.log(`Publishing: "${title}"`);
  console.log(`  Slug: ${slug}`);
  console.log(`  File: site/posts/${postFile}`);
  console.log(`  Date: ${formatDateISO(now)}`);
  console.log(`  Excerpt: ${excerpt.substring(0, 80)}...`);
  console.log("");

  // Collect all existing posts and prepend the new one. (Read-only — safe to
  // run before the dry-run gate so the new rhythm/pagination can be previewed.)
  const allPosts = collectAllPosts();

  // Guard against duplicates (e.g. if publish.js was run twice)
  if (allPosts.some((p) => p.file === `posts/${postFile}`)) {
    console.error(`Error: Post already listed in index: posts/${postFile}`);
    console.error(
      "Remove the duplicate entry from index.html before republishing.",
    );
    process.exit(1);
  }

  const newPost = {
    date: formatDateISO(now),
    file: `posts/${postFile}`,
    title: title,
    excerpt: excerpt,
  };
  allPosts.unshift(newPost);

  // The new post is the newest: its "anterior" (older) neighbour is whatever
  // was newest before; it has no "seguinte" yet.
  const anterior = allPosts.length > 1 ? allPosts[1] : null;
  const postHtml = generatePostHtml(title, contentHtml, now, anterior);

  // Paginate and render every page in memory.
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    const start = (p - 1) * POSTS_PER_PAGE;
    const pagePosts = allPosts.slice(start, start + POSTS_PER_PAGE);
    pages.push({
      page: p,
      target: p === 1 ? INDEX_PATH : path.join(PAGE_DIR, `${p}.html`),
      label: p === 1 ? "site/index.html" : `site/page/${p}.html`,
      html: generateIndexPage(pagePosts, p, totalPages),
      count: pagePosts.length,
    });
  }

  // Preview the homepage rhythm and pagination layout.
  console.log(`  ${allPosts.length} posts across ${totalPages} page(s):`);
  const featuredN = allPosts.length > 0 ? 1 : 0;
  const recentN = Math.min(RECENT_COUNT, Math.max(0, allPosts.length - 1));
  const archiveN = pages[0].count - featuredN - recentN;
  console.log(
    `    page 1: ${featuredN} featured + ${recentN} recent + ${archiveN} archive`,
  );
  for (let p = 2; p <= totalPages; p++) {
    console.log(`    page ${p}: ${pages[p - 1].count} archive`);
  }
  console.log("");

  if (flags.dryRun) {
    console.log("[DRY RUN] No files changed.");
    return;
  }

  // 1. Create the new post file
  fs.writeFileSync(postPath, postHtml);
  console.log(`  Created: site/posts/${postFile}`);

  // 2. Write index + pagination pages
  const changedFiles = [`site/posts/${postFile}`];
  if (!fs.existsSync(PAGE_DIR)) fs.mkdirSync(PAGE_DIR, { recursive: true });

  for (const pg of pages) {
    fs.writeFileSync(pg.target, pg.html);
    changedFiles.push(pg.label);
    console.log(`  Updated: ${pg.label}`);
  }

  // 3. Patch the previously-newest post so it points "seguinte →" at the new
  // post (its own "anterior" is unchanged).
  if (anterior) {
    const prevAnterior = allPosts.length > 2 ? allPosts[2] : null;
    const navChanged = regenerateNeighborNav(anterior, prevAnterior, newPost);
    if (navChanged) {
      changedFiles.push(navChanged);
      console.log(`  Updated nav: ${navChanged}`);
    }
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

if (require.main === module) {
  main();
}

module.exports = {
  collectAllPosts,
  generateIndexPage,
  generateMainContent,
  generatePostHtml,
  generatePostNavInner,
  regenerateNeighborNav,
  markdownToHtml,
  parseFeaturedItem,
  parsePostItems,
  parseArchiveItems,
  POSTS_PER_PAGE,
  RECENT_COUNT,
};
