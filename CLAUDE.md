# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains tools and content for Hugo's blog at https://rascunhos.blog. Includes:
- Static HTML/CSS blog in `site/` folder
- Playwright-based site analysis scripts for extracting design elements

## Commands

```bash
# Install dependencies
npm install

# Run site analysis script (captures screenshots and extracts design info)
node analyze-site.js

# Compare original vs local site (visual + CSS comparison)
node compare-sites.js

# Compare footer styles specifically
node compare-footer.js
```

## Site Structure

```
site/
├── index.html              # Homepage with post list
├── feed.xml                # RSS feed for newsletter automation
├── css/styles.css          # All styling
├── o-culpado/index.html    # Author page
├── posts/                  # Individual post pages
└── page/                   # Pagination pages (2.html, 3.html, etc.)
```

## Email Subscription Setup (Buttondown)

The site uses Buttondown for email subscriptions. To activate:

1. Create a Buttondown account at https://buttondown.email
2. Get the username from the account settings
3. Replace `BUTTONDOWN_USERNAME` with the actual username in all HTML files:
   - `site/index.html`
   - `site/o-culpado/index.html`
   - `site/posts/*.html`
   - `site/page/*.html`

The placeholder appears in:
- Footer subscription forms: `buttondown.email/api/emails/embed-subscribe/BUTTONDOWN_USERNAME`
- Floating subscribe buttons: `buttondown.email/BUTTONDOWN_USERNAME`

## RSS Feed & Automatic Newsletters

The site has an RSS feed (`site/feed.xml`) that Buttondown can monitor to automatically send new posts to subscribers.

### Setup in Buttondown:
1. Go to Buttondown Settings → Automations
2. Enable "RSS to email" feature
3. Enter RSS feed URL: `https://rascunhos.blog/feed.xml`
4. Configure frequency (immediate, daily digest, weekly digest)

### Adding New Posts to RSS:
When publishing a new blog post, add a new `<item>` to `feed.xml`:

```xml
<item>
  <title>Post Title</title>
  <link>https://rascunhos.blog/posts/post-slug.html</link>
  <guid>https://rascunhos.blog/posts/post-slug.html</guid>
  <pubDate>Mon, 13 Jan 2025 00:00:00 +0000</pubDate>
  <description><![CDATA[Post excerpt or summary here...]]></description>
</item>
```

Add new items at the top of the `<channel>` section (after `<atom:link>`), and update `<lastBuildDate>` to the current date.

## Working Conventions

- Hugo and Claude plan before implementation - discuss strategy and get approval before writing code or making changes
- When creating output files for writing (not code), use markdown format
- Ask clarifying questions one at a time
