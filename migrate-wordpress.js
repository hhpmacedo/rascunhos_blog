const fs = require('fs');
const path = require('path');

// Read and parse WordPress XML export
const xmlContent = fs.readFileSync('rascunhos.WordPress.2026-01-13.xml', 'utf8');

// Extract posts from XML
function extractPosts(xml) {
  const posts = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Check if it's a published post
    const postType = item.match(/<wp:post_type><!\[CDATA\[(.*?)\]\]><\/wp:post_type>/);
    const status = item.match(/<wp:status><!\[CDATA\[(.*?)\]\]><\/wp:status>/);

    if (postType && postType[1] === 'post' && status && status[1] === 'publish') {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const content = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
      const postName = item.match(/<wp:post_name><!\[CDATA\[(.*?)\]\]><\/wp:post_name>/);
      const postDate = item.match(/<wp:post_date><!\[CDATA\[(.*?)\]\]><\/wp:post_date>/);

      if (title && content && postName && postDate) {
        posts.push({
          title: title[1],
          content: content[1],
          slug: postName[1],
          date: postDate[1],
          dateObj: new Date(postDate[1].replace(' ', 'T') + 'Z')
        });
      }
    }
  }

  // Sort by date, newest first
  posts.sort((a, b) => b.dateObj - a.dateObj);
  return posts;
}

// Convert WordPress content to clean HTML
function cleanContent(wpContent) {
  return wpContent
    // Remove WordPress block comments
    .replace(/<!-- wp:paragraph -->\n?/g, '')
    .replace(/<!-- \/wp:paragraph -->\n?/g, '')
    .replace(/<!-- wp:.*? -->\n?/g, '')
    .replace(/<!-- \/wp:.*? -->\n?/g, '')
    // Convert WordPress links to local links
    .replace(/href="https:\/\/rascunhos\.blog\/([^"]+)\/"/g, 'href="../posts/$1.html"')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Generate excerpt (first ~300 chars, ending at word boundary)
function generateExcerpt(content, maxLength = 300) {
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;

  let excerpt = text.substring(0, maxLength);
  const lastSpace = excerpt.lastIndexOf(' ');
  if (lastSpace > maxLength - 50) {
    excerpt = excerpt.substring(0, lastSpace);
  }
  return excerpt + '…';
}

// Format date for RSS
function formatRSSDate(date) {
  return date.toUTCString();
}

// Format date for display (not used, but stored)
function formatDisplayDate(dateStr) {
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  return d.toISOString().split('T')[0];
}

// Post HTML template
function postTemplate(post) {
  const cleanedContent = cleanContent(post.content);
  const dateFormatted = formatDisplayDate(post.date);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} – rascunhos</title>
  <link rel="stylesheet" href="../css/styles.css">
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="../feed.xml">
</head>
<body>
  <!-- Post date stored but not displayed: ${dateFormatted} -->
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <div class="menu-icon"><span></span></div>
        <a href="../index.html" class="site-title">rascunhos</a>
      </nav>
    </aside>

    <main class="main-content">
      <article class="post-content" data-date="${dateFormatted}">
        <h1>${post.title}</h1>

        ${cleanedContent}
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
      <p class="footer-tagline">uns vão para o lixo, outros nem por isso</p>

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
</body>
</html>
`;
}

// Homepage/pagination template
function listTemplate(posts, pageNum, totalPages) {
  const isFirstPage = pageNum === 1;
  const pathPrefix = isFirstPage ? '' : '../';
  const cssPath = isFirstPage ? 'css/styles.css' : '../css/styles.css';
  const feedPath = isFirstPage ? 'feed.xml' : '../feed.xml';
  const postsPath = isFirstPage ? 'posts/' : '../posts/';
  const pagePath = isFirstPage ? 'page/' : '';
  const indexPath = isFirstPage ? 'index.html' : '../index.html';
  const authorPath = isFirstPage ? 'o-culpado/' : '../o-culpado/';

  const postListHtml = posts.map((post, idx) => {
    const excerpt = generateExcerpt(cleanContent(post.content));
    const dateFormatted = formatDisplayDate(post.date);
    return `        <!-- Post ${idx + 1} -->
        <li class="post-item" data-date="${dateFormatted}">
          <h2 class="post-title">
            <a href="${postsPath}${post.slug}.html">${post.title}</a>
          </h2>
          <p class="post-excerpt">
            ${excerpt} <a href="${postsPath}${post.slug}.html" class="read-more">ler mais</a>
          </p>
        </li>`;
  }).join('\n\n');

  // Pagination
  let paginationHtml = '';
  if (totalPages > 1) {
    const pageLinks = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === pageNum) {
        pageLinks.push(`<span class="current">${i}</span>`);
      } else if (i === 1) {
        pageLinks.push(`<a href="${indexPath}">1</a>`);
      } else {
        pageLinks.push(`<a href="${pagePath}${i}.html">${i}</a>`);
      }
    }

    if (pageNum < totalPages) {
      pageLinks.push(`<a href="${pagePath}${pageNum + 1}.html">Página seguinte</a>`);
    }

    paginationHtml = `
      <!-- Pagination -->
      <nav class="pagination">
        ${pageLinks.join('\n        ')}
      </nav>`;
  }

  const title = isFirstPage
    ? 'rascunhos – porque a escrita nunca termina, porque fica sempre algo por dizer, por emendar,… ou talvez não.'
    : `rascunhos – Página ${pageNum}`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="${cssPath}">
  <link rel="alternate" type="application/rss+xml" title="rascunhos" href="${feedPath}">
</head>
<body>
  <div class="site-container">
    <aside class="sidebar">
      <nav>
        <div class="menu-icon"><span></span></div>
        <a href="${indexPath}" class="site-title">rascunhos</a>
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
      <p class="footer-tagline">uns vão para o lixo, outros nem por isso</p>

      <div class="footer-subscribe">
        <form action="https://buttondown.email/api/emails/embed-subscribe/hhmacedo" method="post" target="popupwindow">
          <input type="email" name="email" placeholder="o seu email aqui..." required>
          <button type="submit">subscrever</button>
        </form>
      </div>

      <div class="footer-bottom">
        <a href="${authorPath}">autor</a>
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

// Generate RSS feed
function generateRSS(posts) {
  const latestDate = posts[0].dateObj;

  const items = posts.map(post => {
    const excerpt = generateExcerpt(cleanContent(post.content));
    return `    <item>
      <title>${post.title}</title>
      <link>https://rascunhos.blog/posts/${post.slug}.html</link>
      <guid>https://rascunhos.blog/posts/${post.slug}.html</guid>
      <pubDate>${formatRSSDate(post.dateObj)}</pubDate>
      <description><![CDATA[${excerpt}]]></description>
    </item>`;
  }).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>rascunhos</title>
    <link>https://rascunhos.blog</link>
    <description>uns vão para o lixo, outros nem por isso</description>
    <language>pt</language>
    <lastBuildDate>${formatRSSDate(latestDate)}</lastBuildDate>
    <atom:link href="https://rascunhos.blog/feed.xml" rel="self" type="application/rss+xml"/>

${items}

  </channel>
</rss>
`;
}

// Main migration
console.log('Parsing WordPress export...');
const posts = extractPosts(xmlContent);
console.log(`Found ${posts.length} published posts`);

// Create directories
const siteDir = 'site';
const postsDir = path.join(siteDir, 'posts');
const pageDir = path.join(siteDir, 'page');

if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });

// Generate individual post pages
console.log('Generating post pages...');
posts.forEach(post => {
  const filename = path.join(postsDir, `${post.slug}.html`);
  fs.writeFileSync(filename, postTemplate(post));
  console.log(`  Created: ${filename}`);
});

// Generate homepage and pagination (10 posts per page)
const postsPerPage = 10;
const totalPages = Math.ceil(posts.length / postsPerPage);
console.log(`\nGenerating ${totalPages} list pages...`);

for (let page = 1; page <= totalPages; page++) {
  const startIdx = (page - 1) * postsPerPage;
  const pagePosts = posts.slice(startIdx, startIdx + postsPerPage);

  if (page === 1) {
    const filename = path.join(siteDir, 'index.html');
    fs.writeFileSync(filename, listTemplate(pagePosts, page, totalPages));
    console.log(`  Created: ${filename}`);
  } else {
    const filename = path.join(pageDir, `${page}.html`);
    fs.writeFileSync(filename, listTemplate(pagePosts, page, totalPages));
    console.log(`  Created: ${filename}`);
  }
}

// Generate RSS feed
console.log('\nGenerating RSS feed...');
fs.writeFileSync(path.join(siteDir, 'feed.xml'), generateRSS(posts));
console.log('  Created: site/feed.xml');

console.log('\nMigration complete!');
console.log(`Total posts: ${posts.length}`);
console.log(`Pages: ${totalPages}`);
