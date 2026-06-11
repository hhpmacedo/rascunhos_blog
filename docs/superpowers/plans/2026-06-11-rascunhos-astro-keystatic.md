# rascunhos.blog -> Astro + Keystatic CMS - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built static site + add-only `publish.js` with an Astro site (reproducing the v2 design pixel-for-pixel) whose posts are markdown files, edited via a hosted Keystatic admin - so Hugo can add *and edit* posts from any device, with every existing URL and the RSS feed preserved.

**Architecture:** Astro `output: 'static'` + `@astrojs/vercel`. Posts live as `src/content/posts/<slug>.md` (the source of truth). Public pages prerender; Keystatic's `/keystatic` admin + `/api/keystatic/*` run on-demand (GitHub storage in prod). The existing `site/` tree is removed only at cutover, after a rendered-HTML equivalence gate proves the Astro output matches the live site.

**Tech Stack:** Astro 5, `@astrojs/vercel`, `@astrojs/react` + `@keystatic/core` + `@keystatic/astro`, `turndown` (HTML->markdown, migration only), `@astrojs/rss`. Node 24 / npm 11. No unit-test framework - verification is `astro build` (Zod validation) + a per-post **rendered-HTML equivalence gate** + manual preview checks.

**Spec:** `docs/superpowers/specs/2026-06-11-rascunhos-astro-keystatic-design.md`

**Reference implementation:** the `hugo-website` Keystatic build (same Astro+Keystatic+Vercel pattern, same round-trip gate methodology).

---

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `package.json` | Astro + adapter + Keystatic + turndown deps; `dev`/`build` scripts | Create/replace |
| `astro.config.mjs` | `output: static`, `vercel()`, `react()`, `keystatic()` integrations | Create |
| `src/content/config.ts` | `posts` collection Zod schema (the content contract) | Create |
| `public/styles/styles.css` | the existing v2 CSS, copied verbatim | Copy |
| `src/layouts/Base.astro` | `<head>`, footer, GoatCounter, favicon, subscribe-float - shared chrome | Create |
| `src/pages/posts/[slug].html.astro` | post page (literal `.html` route) - article + asterism + prev/next nav + per-post subscribe | Create |
| `src/pages/index.astro` | homepage page 1 - featured + recent + archive rhythm + pagination | Create |
| `src/pages/page/[page].astro` | pagination pages 2..N | Create |
| `src/pages/o-culpado/index.astro` | merged author page | Create |
| `src/pages/autor.html.astro` | redirect -> `/o-culpado/` | Create |
| `src/pages/feed.xml.ts` | RSS feed at `/feed.xml` | Create |
| `keystatic.config.ts` | Keystatic `posts` collection + GitHub/local storage | Create |
| `scripts/migrate-to-astro.mjs` | one-time HTML->markdown migration (deleted after use) | Create->delete |
| `scripts/rendered-html-gate.mjs` | the verification gate (kept as a dev tool) | Create |
| `vercel.json` | drop `outputDirectory: site`; build Astro | Modify (cutover) |
| `.github/workflows/deploy.yml` | redundant GitHub Pages deploy | Delete (cutover) |
| `site/`, `publish.js`, legacy scripts, `*.png`, `*.xml` | legacy static site + tooling | Delete (cutover) |

**Boundary rationale:** Each `.astro` page owns one route's markup; `Base.astro` owns shared chrome so a footer/analytics change happens in one place. Migration logic is isolated in a throwaway script; the gate is a standalone tool reused across tasks. Public-rendering code never imports Keystatic.

---

## A note on the verification gate (used by Tasks 2-5)

The load-bearing risk is that the Astro-rendered HTML diverges from the live site (broken prose line breaks, dropped emphasis, changed URLs). The gate compares **normalized rendered article text** of the Astro build against the **current live `site/` HTML** (the source of truth, already deployed). Task 2 Step 4 creates `scripts/rendered-html-gate.mjs`; later tasks invoke it. With 28 posts it is complete coverage, not a sample.

---

## Task 1: Scaffold Astro + Vercel adapter (architecture gate)

The single load-bearing assumption: `output: 'static'` + the Vercel adapter builds cleanly in this repo while `site/` still exists. A green `astro build` proves the toolchain before any porting. Production is untouched (we do NOT change `vercel.json` yet, so Vercel keeps serving `site/`).

**Files:** Create `package.json` (merge), `astro.config.mjs`, `src/layouts/Base.astro`, `src/pages/index.astro` (temporary), `public/styles/styles.css`, `public/favicon.*`; add `.gitignore` entries.

- [ ] **Step 1: Install Astro + adapter + turndown**

Run:
```bash
npm install astro@^5 @astrojs/vercel@^8
npm install -D turndown
```
Expected: `astro` + `@astrojs/vercel` in `dependencies`, `turndown` in `devDependencies`.

- [ ] **Step 2: Add `.gitignore` entries**

Append to `.gitignore`:
```
dist/
.vercel/
.astro/
.playwright-mcp/
```

- [ ] **Step 3: Copy CSS + favicon into `public/` (live `site/` stays intact)**

Run:
```bash
mkdir -p public/styles
cp site/css/styles.css public/styles/styles.css
cp site/favicon.ico site/favicon.svg public/
```

- [ ] **Step 4: Create `astro.config.mjs`**

```javascript
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://rascunhos.blog",
  output: "static",
  adapter: vercel(),
  markdown: { syntaxHighlight: false },
});
```

- [ ] **Step 5: Merge scripts into `package.json`**

Ensure `package.json` contains `"type": "module"` and:
```json
{
  "scripts": { "dev": "astro dev", "build": "astro build", "preview": "astro preview" }
}
```
(Keep existing fields; add these.)

- [ ] **Step 6: Create `src/layouts/Base.astro`**

Port shared chrome from the live markup. Source: the `<head>`/`<footer class="site-footer">`/subscribe-float/GoatCounter blocks in `site/index.html` and `site/posts/amarfanhado.html`. Skeleton:
```astro
---
interface Props { title: string; description?: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <link rel="stylesheet" href="/styles/styles.css" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/rss+xml" title="rascunhos" href="/feed.xml" />
  </head>
  <body>
    <slot />
    <!-- In this step: paste the exact <footer class="site-footer"> markup from
         site/index.html here, with absolute hrefs (/, /feed.xml, /o-culpado/). -->
    <script
      data-goatcounter="https://rascunhos.goatcounter.com/count"
      async src="//gc.zgo.at/count.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Temporary `src/pages/index.astro`**

```astro
---
import Base from "../layouts/Base.astro";
---
<Base title="rascunhos">
  <main class="main-content"><p>scaffold</p></main>
</Base>
```

- [ ] **Step 8: Build - the architecture gate**

Run: `npm run build`
Expected: build SUCCEEDS; output under `.vercel/output/`. If it fails on `output: static` + adapter, set `output: "server"` in `astro.config.mjs` (public pages still prerender) and re-run. Record which path in the commit.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs .gitignore src/ public/
git commit -m "feat(astro): scaffold Astro + Vercel adapter (build gate green)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Content schema + post route + 2 hand-migrated posts (first render gate)

Prove the post pipeline end-to-end on 2 posts before scripting all 28: schema -> markdown -> Astro post page -> rendered HTML matches the live post.

**Files:** Create `src/content/config.ts`, `src/pages/posts/[slug].html.astro`, `scripts/rendered-html-gate.mjs`, `src/content/posts/amarfanhado.md`, `src/content/posts/velho.md`.

- [ ] **Step 1: Create `src/content/config.ts`**

```typescript
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    excerpt: z.preprocess(emptyToUndefined, z.string().optional()),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

- [ ] **Step 2: Hand-migrate 2 posts**

Create `src/content/posts/amarfanhado.md` and `velho.md`. For each, read the live `site/posts/<slug>.html`: `title` from `<h1>`, `pubDate` from `data-date`, `excerpt` from that post's `post-excerpt` text in `site/index.html`/`site/page/*.html`, body = the `<article>` paragraphs as markdown (each `<p>` -> paragraph; each `<br>` -> hard line break written as a trailing backslash `\`; `<strong>`->`**`, `<em>`->`*`, `<a href>`->`[text](href)`; the asterism `<p class="asterism">` line -> `---`). Frontmatter:
```markdown
---
title: amarfanhado
pubDate: 2026-02-27
excerpt: "Isto não é um conto. É o relato do nosso encontro tal como me contaste…"
---

Isto não é um conto.

É o relato do nosso encontro tal como me contaste.\
Estou sentado, mas as pernas não param. …
```

- [ ] **Step 3: Create `src/pages/posts/[slug].html.astro`**

The literal `.html` in the filename produces `/posts/<slug>.html`. Port the v2 post markup (source: `site/posts/amarfanhado.html`):
```astro
---
import { getCollection, render } from "astro:content";
import Base from "../../layouts/Base.astro";

export async function getStaticPaths() {
  const posts = (await getCollection("posts", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return posts.map((post, i) => ({
    params: { slug: post.id },
    props: { post, anterior: posts[i + 1] ?? null, seguinte: posts[i - 1] ?? null },
  }));
}

const { post, anterior, seguinte } = Astro.props;
const { Content } = await render(post);
const isoDate = post.data.pubDate.toISOString().slice(0, 10);
---
<Base title={`${post.data.title} – rascunhos`} description={post.data.excerpt}>
  <div class="site-container">
    <aside class="sidebar"><nav><a href="/" class="site-title">rascunhos</a></nav></aside>
    <main class="main-content">
      <article class="post-content" data-date={isoDate}>
        <h1>{post.data.title}</h1>
        <Content />
        <p class="post-end">— fim —</p>
      </article>
      <!-- Paste the exact <nav class="post-nav"> + <div class="post-subscribe">
           markup from site/posts/amarfanhado.html, substituting anterior/seguinte
           hrefs as `/posts/${anterior.id}.html` and titles {anterior.data.title}.
           A null neighbour becomes an empty <span></span> spacer. -->
    </main>
  </div>
</Base>
```

- [ ] **Step 4: Create the gate `scripts/rendered-html-gate.mjs`**

```javascript
// Compares Astro-built post HTML against the live site/ HTML, body text only.
// Usage: node scripts/rendered-html-gate.mjs <slug> [<slug> ...]
import { readFile } from "node:fs/promises";

const norm = (html) =>
  html.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();

const articleBody = (html) => {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  return m ? norm(m[1].replace(/<h1[\s\S]*?<\/h1>/, "")) : null;
};

const builtPath = async (slug) => {
  for (const p of [
    `.vercel/output/static/posts/${slug}.html/index.html`,
    `.vercel/output/static/posts/${slug}.html`,
    `dist/posts/${slug}.html/index.html`,
    `dist/posts/${slug}.html`,
  ]) { try { return await readFile(p, "utf8"); } catch {} }
  return null;
};

let fail = 0;
for (const slug of process.argv.slice(2)) {
  const live = await readFile(`site/posts/${slug}.html`, "utf8");
  const built = await builtPath(slug);
  const a = articleBody(live), b = built && articleBody(built);
  // Built page adds "— fim —"/nav/subscribe chrome; the live body must be a PREFIX of it.
  if (b && a && b.startsWith(a)) console.log(`OK   ${slug}`);
  else { console.log(`DIFF ${slug}`); fail++; }
}
process.exit(fail ? 1 : 0);
```

- [ ] **Step 5: Build and run the gate on the 2 posts**

Run:
```bash
npm run build
node scripts/rendered-html-gate.mjs amarfanhado velho
```
Expected: `OK amarfanhado` / `OK velho`. If `DIFF`, inspect live vs built body text, fix the markdown (usually a missing `<br>`->`\` hard break or an emphasis marker), rebuild, re-run until both `OK`.

- [ ] **Step 6: Commit**

```bash
git add src/content/config.ts src/pages/posts/ scripts/rendered-html-gate.mjs src/content/posts/
git commit -m "feat(astro): post schema + route + render gate (2 posts pass)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate all 28 posts via script (the full gate)

**Files:** Create `scripts/migrate-to-astro.mjs`; produce `src/content/posts/*.md` (28 total).

- [ ] **Step 1: Write `scripts/migrate-to-astro.mjs`**

```javascript
import { readFile, readdir, writeFile } from "node:fs/promises";
import TurndownService from "turndown";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
td.addRule("hardbreak", { filter: "br", replacement: () => "\\\n" });
td.addRule("asterism", {
  filter: (n) => n.nodeName === "P" && n.getAttribute("class") === "asterism",
  replacement: () => "\n\n---\n\n",
});

async function excerptMap() {
  const map = {};
  const pages = await readdir("site/page").catch(() => []);
  const files = ["site/index.html", ...pages.map((f) => `site/page/${f}`)];
  const re = /<a href="[^"]*\/?posts\/([^"]+)\.html">[^<]+<\/a>\s*<\/h2>\s*<p class="post-(?:excerpt|excerpt-featured)">\s*([\s\S]*?)\s*<a href="[^"]*" class="read-more">/g;
  for (const f of files) {
    const html = await readFile(f, "utf8").catch(() => "");
    let m; while ((m = re.exec(html))) map[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }
  return map;
}

const yamlStr = (s) => JSON.stringify(s);
const excerpts = await excerptMap();
const dir = "site/posts";
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".html"))) {
  const slug = file.replace(/\.html$/, "");
  const html = await readFile(`${dir}/${file}`, "utf8");
  const title = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1]?.trim() ?? slug;
  const date = (html.match(/data-date="([^"]+)"/) || [])[1] ?? "";
  let body = (html.match(/<article[^>]*>([\s\S]*?)<\/article>/) || [])[1] ?? "";
  body = body
    .replace(/<h1>[\s\S]*?<\/h1>/, "")
    .replace(/<p class="post-end">[\s\S]*?<\/p>/g, "")
    .replace(/<nav class="post-nav">[\s\S]*?<\/nav>/g, "")
    .replace(/<div class="post-subscribe">[\s\S]*?<\/div>/g, "");
  const md = td.turndown(body).replace(/\n{3,}/g, "\n\n").trim();
  const fm = ["---", `title: ${yamlStr(title)}`, `pubDate: ${date}`,
    excerpts[slug] ? `excerpt: ${yamlStr(excerpts[slug])}` : null, "---", ""]
    .filter((x) => x !== null).join("\n");
  await writeFile(`src/content/posts/${slug}.md`, `${fm}\n${md}\n`);
  console.log(`wrote ${slug}.md`);
}
```

- [ ] **Step 2: Run the migration**

Run: `node scripts/migrate-to-astro.mjs`
Expected: `wrote <slug>.md` x 28; `ls src/content/posts/*.md | wc -l` -> 28.

- [ ] **Step 3: Build and run the gate over ALL 28**

Run:
```bash
npm run build
node scripts/rendered-html-gate.mjs $(ls site/posts/*.html | sed 's|site/posts/||;s|\.html||')
```
Expected: 28x `OK`, exit 0. For any `DIFF`: open live vs built body, find the conversion miss (hard break, list, emphasis, asterism, inline `<a>`), fix the turndown rule (if systemic) or that one `.md` by hand (if one-off), rebuild, re-run. **Do not proceed until all 28 are OK** - this gate protects the content.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-astro.mjs src/content/posts/
git commit -m "feat(astro): migrate all 28 posts to markdown (render gate green)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Homepage + pagination

**Files:** Create `src/pages/index.astro`, `src/pages/page/[page].astro`. Constants: `POSTS_PER_PAGE = 10`, `RECENT_COUNT = 2`.

- [ ] **Step 1: Replace the temporary `src/pages/index.astro`**

Reproduce the v2 rhythm. Source markup: `site/index.html` (`<section class="post-featured">` + kicker "o mais recente", 2 large recent `<li class="post-item">`, then `<p class="kicker">mais rascunhos</p>` + `<ul class="post-list">` archive, then `<nav class="pagination">`). Logic:
```astro
---
import { getCollection } from "astro:content";
import Base from "../layouts/Base.astro";
const POSTS_PER_PAGE = 10, RECENT_COUNT = 2;
const posts = (await getCollection("posts", ({ data }) => !data.draft))
  .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
const pageOne = posts.slice(0, POSTS_PER_PAGE);
const [featured, ...rest] = pageOne;
const recent = rest.slice(0, RECENT_COUNT);
const archive = rest.slice(RECENT_COUNT);
const href = (p) => `/posts/${p.id}.html`;
---
<Base title="rascunhos – porque a escrita nunca termina, porque fica sempre algo por dizer, por emendar,… ou talvez não.">
  <!-- Paste site/index.html's <section class="post-featured">, the 2 recent large
       <li class="post-item">, the "mais rascunhos" <ul class="post-list">, and
       <nav class="pagination"> markup, driven by {featured}/{recent}/{archive}/{totalPages}. -->
</Base>
```

- [ ] **Step 2: Create `src/pages/page/[page].astro`**

```astro
---
import { getCollection } from "astro:content";
import Base from "../../layouts/Base.astro";
const POSTS_PER_PAGE = 10;
export async function getStaticPaths() {
  const posts = (await getCollection("posts", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2).map((page) => ({
    params: { page: String(page) },
    props: { items: posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE), page, totalPages },
  }));
}
const { items, page, totalPages } = Astro.props;
const href = (p) => `/posts/${p.id}.html`;
---
<Base title={`rascunhos – Página ${page}`}>
  <!-- Paste site/page/2.html's <ul class="post-list"> + <nav class="pagination">
       (archive list only - no featured on pages >= 2), driven by {items}/{page}/{totalPages}. -->
</Base>
```

- [ ] **Step 3: Build + visual parity check**

Run: `npm run build && npm run preview`, then open `http://localhost:4321/`, `/page/2.html`, `/page/3.html`. Compare against the live `site/index.html`/`site/page/*.html` (open both / screenshot-diff). Featured/recent/archive ordering, excerpts, and pagination links must match. Fix markup until they do.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/page/
git commit -m "feat(astro): homepage rhythm + pagination

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Author page, autor.html redirect, RSS

**Files:** Create `src/pages/o-culpado/index.astro`, `src/pages/autor.html.astro` (or config redirect), `src/pages/feed.xml.ts`.

- [ ] **Step 1: Author page `src/pages/o-culpado/index.astro`**

Port the merged markup verbatim from `site/o-culpado/index.html` (already has the final merged content + contact + footer) into a `Base`-wrapped Astro page. Static content - copy `<article class="author-content">…</article>` exactly.

- [ ] **Step 2: `/autor.html` redirect**

Add to `astro.config.mjs`:
```javascript
  redirects: { "/autor.html": "/o-culpado/" },
```
(Astro emits a redirect for static output. Verify `/autor.html` -> `/o-culpado/` in the build output. If a page file is needed instead, create `src/pages/autor.html.astro` with frontmatter `return Astro.redirect("/o-culpado/", 301);`.)

- [ ] **Step 3: RSS `src/pages/feed.xml.ts`** (keeps the exact `/feed.xml` URL)

```typescript
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = (await getCollection("posts", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
  return rss({
    title: "rascunhos",
    description: "uns vão para o lixo, outros nem por isso",
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      link: `/posts/${p.id}.html`,
      pubDate: p.data.pubDate,
      description: p.data.excerpt ?? "",
    })),
  });
}
```
Install: `npm install @astrojs/rss`.

- [ ] **Step 4: Build + parity checks**

Run: `npm run build`. Verify `/o-culpado/` renders the merged page; `/autor.html` redirects to `/o-culpado/`; `/feed.xml` exists and its items (titles, `/posts/<slug>.html` links, pubDates, descriptions) match the live `site/feed.xml`, newest first.

- [ ] **Step 5: Commit**

```bash
git add src/pages/o-culpado/ src/pages/feed.xml.ts package.json package-lock.json astro.config.mjs
git commit -m "feat(astro): author page, autor.html redirect, RSS feed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Keystatic CMS

Mirror the validated `hugo-website` setup.

**Files:** Modify `astro.config.mjs`; create `keystatic.config.ts`.

- [ ] **Step 1: Install React + Keystatic**

Run:
```bash
npx astro add react --yes
npm install @keystatic/core @keystatic/astro
```
Then pin the two Keystatic packages to their exact resolved versions in `package.json` (no `^`), confirming they target Astro 5.

- [ ] **Step 2: Register integrations in `astro.config.mjs`**

Add `react()` and `keystatic()` to `integrations` (keep `output: 'static'`, `vercel()`, `redirects`):
```javascript
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
// integrations: [react(), keystatic()],
```

- [ ] **Step 3: Create `keystatic.config.ts`**

```typescript
import { config, fields, collection } from "@keystatic/core";

const useGithub =
  !import.meta.env.DEV ||
  import.meta.env.PUBLIC_KEYSTATIC_STORAGE === "github";

export default config({
  storage: useGithub
    ? { kind: "github", repo: "hhpmacedo/rascunhos_blog" }
    : { kind: "local" },
  ui: { brand: { name: "rascunhos" } },
  collections: {
    posts: collection({
      label: "Rascunhos",
      slugField: "title",
      path: "src/content/posts/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "pubDate"],
      schema: {
        title: fields.slug({ name: { label: "Título", validation: { isRequired: true } } }),
        pubDate: fields.date({ label: "Data", validation: { isRequired: true } }),
        excerpt: fields.text({ label: "Excerto", multiline: true,
          description: "Opcional. Resumo nas listagens/RSS; se vazio, derivado do texto." }),
        draft: fields.checkbox({ label: "Rascunho (oculto)", defaultValue: false }),
        content: fields.markdoc({ label: "Texto", extension: "md" }),
      },
    }),
  },
});
```

- [ ] **Step 4: Build gate + local admin check**

Run: `npm run build` (must stay green with `output: static`; if it forces server output, apply the documented fallback). Then `npm run dev`, open `http://localhost:4321/keystatic` -> admin loads in local mode, lists Rascunhos with all 28, fields render. Open one post - `Texto` shows the body.

- [ ] **Step 5: Round-trip gate (local mode)**

In the admin, append a char to one post's body, Save, remove it, Save (forces re-serialization). Run `npm run build` and `node scripts/rendered-html-gate.mjs <that-slug>` -> must stay `OK`. If `DIFF`, the markdoc body serializer changed something - inspect before trusting it. Revert the test edit: `git checkout -- src/content/posts/<slug>.md`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs keystatic.config.ts tsconfig.json
git commit -m "feat(cms): Keystatic admin (local dev + github prod) at /keystatic

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Cutover, cleanup, and GitHub App (interactive - Hugo)

Flip production from the static `site/` to the Astro build, remove legacy files, wire Keystatic GitHub auth. Several steps require Hugo (GitHub App wizard, Vercel env vars).

**Files:** Modify `vercel.json`; delete `.github/workflows/deploy.yml`, `site/`, `publish.js`, legacy scripts, `scripts/migrate-to-astro.mjs`.

- [ ] **Step 1: Point Vercel at the Astro build**

Replace `vercel.json` with:
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "astro" }
```

- [ ] **Step 2: Push branch -> validate the Vercel preview**

```bash
git add vercel.json && git commit -m "build: Vercel builds Astro (cutover)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin feat/astro-keystatic-cms
```
On the Vercel preview URL: confirm build SUCCEEDS; spot-check several `/posts/<slug>.html`, `/`, `/page/2.html`, `/o-culpado/`, `/autor.html` (redirect), `/feed.xml`. Use the Vercel MCP share-link if deployment protection blocks access. `/keystatic` returns 200 (github-mode setup screen; `/api/keystatic/github/*` 500 until env vars exist - expected, per the hugo-website findings).

- [ ] **Step 3: Delete legacy files**

```bash
git rm -r site publish.js migrate-wordpress.js analyze-site.js compare-sites.js \
  compare-footer.js extract-css.js scripts/migrate-to-astro.mjs
git rm -f homepage-full.png homepage-viewport.png page-source.html rascunhos.WordPress.2026-01-13.xml 2>/dev/null || true
git commit -m "chore: remove legacy static site + publish.js after Astro cutover
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Keep `public/`, `src/`, `keystatic.config.ts`, `scripts/rendered-html-gate.mjs`. Run `npm run build` to confirm nothing referenced deleted files.

- [ ] **Step 4: Remove the GitHub Pages workflow**

```bash
git rm .github/workflows/deploy.yml
git commit -m "chore: remove redundant GitHub Pages workflow (Vercel serves the apex)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

- [ ] **Step 5 (Hugo): GitHub App wizard - locally**

```bash
PUBLIC_KEYSTATIC_STORAGE=github npm run dev
```
Open `http://localhost:4321/keystatic/setup`. Deployed App URL = `https://rascunhos.blog`; org blank; **Create GitHub App**, authorize, grant access to `hhpmacedo/rascunhos_blog`. Keystatic writes 4 vars to `.env` (gitignored): `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Stop dev.

- [ ] **Step 6 (Hugo): Vercel env vars + redeploy**

In the `rascunhos-blog` Vercel project -> Environment Variables, add all 4 for **Production + Preview** (the `PUBLIC_*` one is build-time -> redeploy after).

- [ ] **Step 7: Merge to `main` -> production**

```bash
git checkout main && git merge feat/astro-keystatic-cms --no-ff && git push origin main
```
Confirm `https://rascunhos.blog/` and a few `/posts/<slug>.html` serve the Astro build; `/keystatic` lets Hugo log in and edit; a test edit commits to `src/content/posts/` and redeploys. Delete the test edit after.

- [ ] **Step 8: Update CLAUDE.md**

Replace the `publish.js` workflow docs with: posts live in `src/content/posts/*.md`; edit via `/keystatic` (GitHub mode) or locally; `npm run dev`/`npm run build`; the 4 `KEYSTATIC_*` env vars; **plain markdown only** in the editor (Markdoc tags render literally); avoid changing a published post's slug (URL change). Commit.

---

## Notes for the implementer

- **No unit tests.** Gates are `astro build` (Zod validation) + `scripts/rendered-html-gate.mjs` (per-post body equivalence) + manual preview parity. Don't invent a framework.
- **The content gate (Task 3 Step 3) must be 100% green before cutover.** It protects 28 posts of prose whose line breaks (`<br>`->`\`) and asterisms are easy to drop in HTML->markdown.
- **URLs are sacred:** the literal `[slug].html.astro` route + `/autor.html` redirect + `/feed.xml` filename preserve every existing path. Verify each on the preview before deleting `site/`.
- **Keystatic interactive steps** (App wizard, Vercel env) require Hugo - pause and hand off, don't guess secrets.
- **Don't touch `main`/production until Task 7.** All porting happens on `feat/astro-keystatic-cms`; the live static site keeps serving until the Vercel build flips to Astro.
