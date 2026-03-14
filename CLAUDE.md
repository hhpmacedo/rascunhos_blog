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

# Publish a new blog post (creates HTML, updates index/pagination/RSS, commits & pushes)
node publish.js "Post Title" content.md
node publish.js content.md              # title from first # heading or filename
node publish.js --dry-run content.md    # preview without changes
node publish.js --no-push content.md    # commit but don't push

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

## Analytics (GoatCounter)

The site uses GoatCounter for privacy-friendly visitor tracking:

- Dashboard: https://rascunhos.goatcounter.com
- Script added to all HTML pages (no cookies, GDPR-compliant)
- Tracks pageviews per page, referrers, and basic browser info

## Email Subscription (Buttondown)

The site uses Buttondown (username: `hhmacedo`) for email subscriptions:

- Footer forms submit to Buttondown's embed API
- Floating subscribe buttons link to Buttondown's hosted page
- Newsletters are sent manually via the Buttondown dashboard

## RSS Feed

The site has an RSS feed (`site/feed.xml`) that readers can subscribe to directly.

### Adding New Posts to RSS:

The `publish.js` script handles RSS updates automatically. For manual edits, add a new `<item>` at the top of the `<channel>` section (after `<atom:link>`) and update `<lastBuildDate>`.

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
