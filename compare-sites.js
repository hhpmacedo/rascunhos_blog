const { chromium } = require('playwright');
const fs = require('fs');

async function compareSites() {
  const browser = await chromium.launch();

  // Take screenshot of original site
  console.log('Capturing original site...');
  const originalPage = await browser.newPage();
  await originalPage.setViewportSize({ width: 1200, height: 900 });
  await originalPage.goto('https://rascunhos.blog', { waitUntil: 'networkidle' });
  await originalPage.screenshot({ path: 'comparison/original.png', fullPage: true });
  await originalPage.screenshot({ path: 'comparison/original-viewport.png' });

  // Extract detailed styles from original
  const originalStyles = await originalPage.evaluate(() => {
    const getStyles = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textTransform: styles.textTransform,
        marginTop: styles.marginTop,
        marginBottom: styles.marginBottom,
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom,
        maxWidth: styles.maxWidth,
        width: styles.width,
      };
    };

    const getRect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    return {
      body: getStyles('body'),
      sidebar: getStyles('nav a, header a'),
      sidebarRect: getRect('nav, header'),
      postTitle: getStyles('h2'),
      postTitleRect: getRect('h2'),
      postExcerpt: getStyles('article p, .post p, main p'),
      readMore: getStyles('article a, .read-more, main a[href*="ler"]'),
      footer: getStyles('footer'),
      footerTitle: getStyles('footer h2, footer .footer-title'),
      // Get layout info
      mainContent: getRect('main, article, .content'),
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
    };
  });

  await originalPage.close();

  // Start local server and capture
  console.log('\nCapturing local site...');
  console.log('Starting local server on port 8080...');

  const localPage = await browser.newPage();
  await localPage.setViewportSize({ width: 1200, height: 900 });

  // Serve local files
  await localPage.goto('file:///Users/hugomacedo_pd/Documents/GitHub/rascunhos_blog/site/index.html', { waitUntil: 'networkidle' });
  await localPage.screenshot({ path: 'comparison/local.png', fullPage: true });
  await localPage.screenshot({ path: 'comparison/local-viewport.png' });

  // Extract styles from local
  const localStyles = await localPage.evaluate(() => {
    const getStyles = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textTransform: styles.textTransform,
        marginTop: styles.marginTop,
        marginBottom: styles.marginBottom,
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom,
        maxWidth: styles.maxWidth,
        width: styles.width,
      };
    };

    const getRect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    return {
      body: getStyles('body'),
      sidebar: getStyles('.sidebar a'),
      sidebarRect: getRect('.sidebar'),
      postTitle: getStyles('.post-title'),
      postTitleRect: getRect('.post-title'),
      postExcerpt: getStyles('.post-excerpt'),
      readMore: getStyles('.read-more'),
      footer: getStyles('.site-footer'),
      footerTitle: getStyles('.footer-title'),
      mainContent: getRect('.main-content'),
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
    };
  });

  await localPage.close();
  await browser.close();

  // Compare and report differences
  console.log('\n=== STYLE COMPARISON ===\n');

  const compareStyles = (name, original, local) => {
    if (!original || !local) {
      console.log(`${name}: Missing data (original: ${!!original}, local: ${!!local})`);
      return;
    }

    const diffs = [];
    for (const key of Object.keys(original)) {
      if (original[key] !== local[key]) {
        diffs.push(`  ${key}: "${original[key]}" vs "${local[key]}"`);
      }
    }

    if (diffs.length > 0) {
      console.log(`${name} DIFFERENCES:`);
      diffs.forEach(d => console.log(d));
      console.log('');
    } else {
      console.log(`${name}: MATCH ✓\n`);
    }
  };

  compareStyles('BODY', originalStyles.body, localStyles.body);
  compareStyles('POST TITLE', originalStyles.postTitle, localStyles.postTitle);
  compareStyles('POST EXCERPT', originalStyles.postExcerpt, localStyles.postExcerpt);
  compareStyles('SIDEBAR', originalStyles.sidebar, localStyles.sidebar);
  compareStyles('FOOTER', originalStyles.footer, localStyles.footer);

  console.log('=== LAYOUT COMPARISON ===\n');
  console.log('Original sidebar position:', originalStyles.sidebarRect);
  console.log('Local sidebar position:', localStyles.sidebarRect);
  console.log('');
  console.log('Original main content:', originalStyles.mainContent);
  console.log('Local main content:', localStyles.mainContent);

  // Save comparison data
  fs.writeFileSync('comparison/original-styles.json', JSON.stringify(originalStyles, null, 2));
  fs.writeFileSync('comparison/local-styles.json', JSON.stringify(localStyles, null, 2));

  console.log('\nScreenshots saved to comparison/ folder');
  console.log('Style data saved to comparison/*.json');
}

// Create comparison folder
if (!fs.existsSync('comparison')) {
  fs.mkdirSync('comparison');
}

compareSites().catch(console.error);
