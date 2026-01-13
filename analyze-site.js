const { chromium } = require('playwright');

async function analyzeSite() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Navigating to rascunhos.blog...');
  await page.goto('https://rascunhos.blog', { waitUntil: 'networkidle' });

  // Take full page screenshot
  await page.screenshot({ path: 'homepage-full.png', fullPage: true });
  console.log('Screenshot saved: homepage-full.png');

  // Take viewport screenshot
  await page.screenshot({ path: 'homepage-viewport.png' });
  console.log('Screenshot saved: homepage-viewport.png');

  // Extract page structure
  const analysis = await page.evaluate(() => {
    const getComputedStyles = (el) => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        lineHeight: styles.lineHeight,
        maxWidth: styles.maxWidth,
      };
    };

    // Get page title
    const title = document.title;

    // Get meta description
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

    // Get body styles
    const bodyStyles = getComputedStyles(document.body);

    // Get all navigation links
    const navLinks = [...document.querySelectorAll('nav a, header a, .menu a, .navigation a')]
      .map(a => ({ text: a.textContent.trim(), href: a.href }));

    // Get main content area styles
    const mainContent = document.querySelector('main, article, .content, .post, #content');
    const contentStyles = mainContent ? getComputedStyles(mainContent) : null;

    // Get headings structure
    const headings = [...document.querySelectorAll('h1, h2, h3')]
      .slice(0, 10)
      .map(h => ({
        tag: h.tagName,
        text: h.textContent.trim().substring(0, 100),
        styles: getComputedStyles(h)
      }));

    // Get all unique colors used
    const allElements = document.querySelectorAll('*');
    const colors = new Set();
    const bgColors = new Set();
    allElements.forEach(el => {
      const styles = window.getComputedStyle(el);
      if (styles.color) colors.add(styles.color);
      if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        bgColors.add(styles.backgroundColor);
      }
    });

    // Get links for blog posts
    const postLinks = [...document.querySelectorAll('article a, .post a, .entry a, main a')]
      .slice(0, 10)
      .map(a => ({ text: a.textContent.trim().substring(0, 50), href: a.href }));

    // Get footer content
    const footer = document.querySelector('footer');
    const footerText = footer ? footer.textContent.trim().substring(0, 200) : '';

    // Get page HTML structure (simplified)
    const getStructure = (el, depth = 0) => {
      if (depth > 3 || !el) return null;
      const tag = el.tagName?.toLowerCase();
      if (!tag || ['script', 'style', 'noscript'].includes(tag)) return null;

      const children = [...(el.children || [])]
        .map(c => getStructure(c, depth + 1))
        .filter(Boolean)
        .slice(0, 5);

      return {
        tag,
        id: el.id || undefined,
        class: el.className?.toString().substring(0, 100) || undefined,
        childCount: el.children?.length || 0,
        children: children.length ? children : undefined
      };
    };

    const structure = getStructure(document.body);

    return {
      title,
      metaDesc,
      bodyStyles,
      contentStyles,
      navLinks,
      headings,
      colors: [...colors].slice(0, 10),
      bgColors: [...bgColors].slice(0, 10),
      postLinks,
      footerText,
      structure
    };
  });

  console.log('\n=== SITE ANALYSIS ===\n');
  console.log(JSON.stringify(analysis, null, 2));

  // Get the HTML of the page
  const html = await page.content();
  require('fs').writeFileSync('page-source.html', html);
  console.log('\nHTML source saved: page-source.html');

  await browser.close();
}

analyzeSite().catch(console.error);
