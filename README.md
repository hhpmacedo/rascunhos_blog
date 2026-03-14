# rascunhos.blog

Static blog at https://rascunhos.blog — personal writing in Portuguese.

## Publishing a New Post

Write your post in markdown, then run:

```bash
node publish.js "Post Title" content.md
```

Or let the script extract the title from the first `# heading`:

```bash
node publish.js content.md
```

This automatically:

- Converts markdown to HTML matching the site template
- Adds the post to the homepage and reflows pagination
- Updates the RSS feed
- Commits and pushes to GitHub (triggers deploy)

### Options

- `--dry-run` — preview what would happen without making changes
- `--no-push` — commit locally but don't push

### Supported Markdown

- Paragraphs (separated by blank lines)
- Line breaks (single newline becomes `<br>`)
- `*italic*` and `**bold**`
- `[link text](url)`

### Updating an Existing Post

Edit the HTML file directly in `site/posts/`.

## Site Structure

```
site/
├── index.html              # Homepage (10 most recent posts)
├── feed.xml                # RSS feed
├── css/styles.css          # All styling
├── o-culpado/index.html    # Author page
├── posts/                  # Individual post pages
└── page/                   # Pagination (2.html, 3.html, etc.)
```

## Other Scripts

```bash
npm install                  # Install dependencies (Playwright)
node analyze-site.js         # Capture screenshots and extract design info
node compare-sites.js        # Compare original vs local site
node compare-footer.js       # Compare footer styles
```
