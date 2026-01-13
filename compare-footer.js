const { chromium } = require('playwright');
const fs = require('fs');

async function compareFooter() {
  const browser = await chromium.launch();

  // Capture original site footer
  console.log('Capturing original site footer...');
  const originalPage = await browser.newPage();
  await originalPage.setViewportSize({ width: 1200, height: 900 });
  await originalPage.goto('https://rascunhos.blog/', { waitUntil: 'networkidle' });

  // Scroll to footer
  await originalPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await originalPage.waitForTimeout(500);
  await originalPage.screenshot({ path: 'comparison/original-footer.png' });

  // Extract footer styles
  const originalFooterStyles = await originalPage.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('.site-footer');
    const footerTitle = document.querySelector('footer h2') || document.querySelector('.footer-title');
    const footerTagline = document.querySelector('footer p');
    const footerInput = document.querySelector('footer input[type="email"]');
    const footerButton = document.querySelector('footer button');

    const getStyles = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        backgroundColor: s.backgroundColor,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        padding: s.padding,
        margin: s.margin,
        border: s.border,
        borderRadius: s.borderRadius,
      };
    };

    return {
      footer: getStyles(footer),
      title: getStyles(footerTitle),
      tagline: getStyles(footerTagline),
      input: getStyles(footerInput),
      button: getStyles(footerButton),
    };
  });

  await originalPage.close();

  // Capture local site footer
  console.log('Capturing local site footer...');
  const localPage = await browser.newPage();
  await localPage.setViewportSize({ width: 1200, height: 900 });
  await localPage.goto('file:///Users/hugomacedo_pd/Documents/GitHub/rascunhos_blog/site/index.html', { waitUntil: 'networkidle' });

  // Scroll to footer
  await localPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await localPage.waitForTimeout(500);
  await localPage.screenshot({ path: 'comparison/local-footer.png' });

  // Extract local footer styles
  const localFooterStyles = await localPage.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('.site-footer');
    const footerTitle = document.querySelector('footer h2') || document.querySelector('.footer-title');
    const footerTagline = document.querySelector('footer p');
    const footerInput = document.querySelector('footer input[type="email"]');
    const footerButton = document.querySelector('footer button');

    const getStyles = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        backgroundColor: s.backgroundColor,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        padding: s.padding,
        margin: s.margin,
        border: s.border,
        borderRadius: s.borderRadius,
      };
    };

    return {
      footer: getStyles(footer),
      title: getStyles(footerTitle),
      tagline: getStyles(footerTagline),
      input: getStyles(footerInput),
      button: getStyles(footerButton),
    };
  });

  await localPage.close();
  await browser.close();

  // Compare
  console.log('\n=== FOOTER STYLE COMPARISON ===\n');

  const compare = (name, orig, local) => {
    if (!orig || !local) {
      console.log(`${name}: Missing (orig: ${!!orig}, local: ${!!local})`);
      return;
    }
    const diffs = [];
    for (const key of Object.keys(orig)) {
      if (orig[key] !== local[key]) {
        diffs.push(`  ${key}:\n    original: "${orig[key]}"\n    local:    "${local[key]}"`);
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

  compare('FOOTER', originalFooterStyles.footer, localFooterStyles.footer);
  compare('TITLE', originalFooterStyles.title, localFooterStyles.title);
  compare('TAGLINE', originalFooterStyles.tagline, localFooterStyles.tagline);
  compare('INPUT', originalFooterStyles.input, localFooterStyles.input);
  compare('BUTTON', originalFooterStyles.button, localFooterStyles.button);

  fs.writeFileSync('comparison/footer-original.json', JSON.stringify(originalFooterStyles, null, 2));
  fs.writeFileSync('comparison/footer-local.json', JSON.stringify(localFooterStyles, null, 2));

  console.log('Screenshots saved to comparison/');
}

compareFooter().catch(console.error);
