const { chromium } = require('playwright');
const fs = require('fs');

async function extractCSS() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Navigating to rascunhos.blog...');
  await page.goto('https://rascunhos.blog', { waitUntil: 'networkidle' });

  const cssData = await page.evaluate(() => {
    const getFullStyles = (el) => {
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        fontStyle: styles.fontStyle,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textTransform: styles.textTransform,
        textDecoration: styles.textDecoration,
        margin: styles.margin,
        marginTop: styles.marginTop,
        marginBottom: styles.marginBottom,
        marginLeft: styles.marginLeft,
        marginRight: styles.marginRight,
        padding: styles.padding,
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        maxWidth: styles.maxWidth,
        width: styles.width,
        display: styles.display,
        position: styles.position,
        top: styles.top,
        left: styles.left,
        gap: styles.gap,
        flexDirection: styles.flexDirection,
        writingMode: styles.writingMode,
        textOrientation: styles.textOrientation,
        transform: styles.transform,
      };
    };

    const getRect = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    };

    // Body
    const body = getFullStyles(document.body);

    // Find sidebar/nav area
    const nav = document.querySelector('nav') || document.querySelector('header nav');
    const navStyles = getFullStyles(nav);
    const navRect = getRect(nav);

    // Find the vertical "rascunhos" text
    const allLinks = document.querySelectorAll('a');
    let sidebarLink = null;
    let sidebarLinkStyles = null;
    for (const link of allLinks) {
      const styles = window.getComputedStyle(link);
      if (styles.writingMode === 'vertical-rl' || link.textContent.trim() === 'rascunhos') {
        sidebarLink = link;
        sidebarLinkStyles = getFullStyles(link);
        break;
      }
    }

    // Find hamburger/menu button
    const menuButton = document.querySelector('button[aria-label*="Menu"]') ||
                       document.querySelector('.wp-block-navigation__responsive-container-open') ||
                       document.querySelector('nav button');
    const menuButtonStyles = getFullStyles(menuButton);
    const menuButtonRect = getRect(menuButton);

    // Main content area
    const main = document.querySelector('main');
    const mainStyles = getFullStyles(main);
    const mainRect = getRect(main);

    // First post title (h2)
    const h2 = document.querySelector('h2');
    const h2Styles = getFullStyles(h2);
    const h2Rect = getRect(h2);

    // Post excerpt paragraph
    const articleP = document.querySelector('article p') || document.querySelector('main p');
    const pStyles = getFullStyles(articleP);

    // "ler mais" link
    const lerMais = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('ler mais'));
    const lerMaisStyles = getFullStyles(lerMais);

    // Footer
    const footer = document.querySelector('footer');
    const footerStyles = getFullStyles(footer);

    // Subscribe button
    const subscribeBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.toLowerCase().includes('subscribe') || b.textContent.toLowerCase().includes('subscrever')
    );
    const subscribeBtnStyles = getFullStyles(subscribeBtn);
    const subscribeBtnRect = getRect(subscribeBtn);

    // Get spacing between posts
    const articles = document.querySelectorAll('article') || document.querySelectorAll('.post-item');
    let postSpacing = null;
    if (articles.length >= 2) {
      const rect1 = articles[0].getBoundingClientRect();
      const rect2 = articles[1].getBoundingClientRect();
      postSpacing = Math.round(rect2.top - rect1.bottom);
    }

    // Get all h2s to measure spacing
    const h2s = document.querySelectorAll('h2');
    let h2Spacing = null;
    if (h2s.length >= 2) {
      const rect1 = h2s[0].getBoundingClientRect();
      const rect2 = h2s[1].getBoundingClientRect();
      h2Spacing = Math.round(rect2.top - rect1.top);
    }

    return {
      body,
      nav: navStyles,
      navRect,
      sidebarLink: sidebarLinkStyles,
      menuButton: menuButtonStyles,
      menuButtonRect,
      main: mainStyles,
      mainRect,
      h2: h2Styles,
      h2Rect,
      paragraph: pStyles,
      lerMais: lerMaisStyles,
      footer: footerStyles,
      subscribeBtn: subscribeBtnStyles,
      subscribeBtnRect,
      postSpacing,
      h2Spacing,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  });

  console.log('\n=== EXTRACTED CSS FROM ORIGINAL SITE ===\n');
  console.log(JSON.stringify(cssData, null, 2));

  fs.writeFileSync('comparison/original-css-full.json', JSON.stringify(cssData, null, 2));
  console.log('\nSaved to comparison/original-css-full.json');

  await browser.close();
}

extractCSS().catch(console.error);
