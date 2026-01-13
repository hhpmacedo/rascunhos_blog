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

## Email Subscription (Buttondown)

The site uses Buttondown (username: `hhmacedo`) for email subscriptions:
- Footer forms submit to Buttondown's embed API
- Floating subscribe buttons link to Buttondown's hosted page
- Newsletters are sent manually via the Buttondown dashboard

## RSS Feed

The site has an RSS feed (`site/feed.xml`) that readers can subscribe to directly.

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

## Feature Backlog

Features to implement later:

- **RSS-to-email automation**: Automatically send new posts to newsletter subscribers. Options:
  - Buttondown paid plan (enables RSS monitoring)
  - Switch to Mailchimp (free tier includes RSS-to-email)
  - Switch to MailerLite (free tier includes RSS-to-email)

## Working Conventions

- Hugo and Claude plan before implementation - discuss strategy and get approval before writing code or making changes
- When creating output files for writing (not code), use markdown format
- Ask clarifying questions one at a time
