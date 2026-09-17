# haoyong.fan Hugo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local Node.js static-site pipeline with a custom Hugo site generated from GitHub Markdown and automatically deployed to `haoyong.fan` through GitHub Actions.

**Architecture:** The repository becomes a Hugo project. Markdown under `content/` is rendered by custom templates in `layouts/`, with CSS and progressive-enhancement JavaScript under `static/`. A GitHub Actions workflow builds with pinned Hugo Extended, uploads only the generated `public/` files over SSH, backs up the remote site before replacement, and performs an HTTPS smoke check.

**Tech Stack:** Hugo Extended, Markdown front matter, HTML templates, CSS, vanilla JavaScript, GitHub Actions, OpenSSH/rsync or SFTP.

---

## File Map

- Create `hugo.toml`: site metadata, base URL, taxonomies, permalinks, markup, and output settings.
- Create `content/_index.md`: homepage data and hero/current-focus content.
- Create `content/about.md`: migrated About page content and front matter.
- Create `content/experience/*.md`: one Markdown file per experience entry.
- Create `content/projects/*.md`: one Markdown file per project entry.
- Move `src/content/posts/*.md` to `content/blog/*.md`: normalize front matter and preserve article bodies.
- Create `layouts/_default/baseof.html`: shared HTML document, metadata, navigation, footer, and asset loading.
- Create `layouts/index.html`: homepage hero, status panel, featured projects, and latest posts.
- Create `layouts/about.html`, `layouts/experience/list.html`, `layouts/experience/single.html`, `layouts/projects/list.html`, and `layouts/projects/single.html`: section pages and entries.
- Create `layouts/blog/list.html`, `layouts/blog/single.html`, and `layouts/taxonomy/term.html`: blog, post, and tag pages.
- Create `layouts/404.html`, `layouts/robots.txt`, and `layouts/_default/rss.xml`: fallback, crawler, and feed output.
- Create `layouts/partials/{head,header,footer,nav,card-project,card-post}.html`: focused reusable fragments.
- Create `static/css/site.css`: terminal-laboratory design system and responsive layout.
- Create `static/js/site.js`: mobile navigation with keyboard and reduced-motion support.
- Create `static/favicon.svg`: migrate the existing favicon without depending on `src/`.
- Create `.github/workflows/deploy.yml`: build, secure upload, backup, and HTTPS verification.
- Create `.gitignore`: ignore `public/`, Hugo caches, Node artifacts, and local environment files.
- Delete legacy `build.js`, `package.json`, `package-lock.json`, `src/`, and checked-in `dist/` after migration verification; do not delete until the new build passes.

## Task 1: Add Hugo Project Skeleton and Content Model

**Files:** Create `hugo.toml`, `.gitignore`, `content/_index.md`, `content/about.md`, `content/experience/*.md`, `content/projects/*.md`, and `content/blog/*.md`.

- [ ] **Step 1: Define Hugo configuration**

Create `hugo.toml` with:

```toml
baseURL = 'https://haoyong.fan/'
languageCode = 'en-us'
defaultContentLanguage = 'en'
enableRobotsTXT = true
enableGitInfo = false

[params]
  description = 'Haoyong Fan — full-stack developer building reliable systems and developer tools.'
  author = 'Haoyong Fan'

[taxonomies]
  tag = 'tags'

[permalinks]
  blog = '/blog/:slug/'

[markup.goldmark.renderer]
  unsafe = true

[markup.highlight]
  noClasses = false
  lineNos = false
```

- [ ] **Step 2: Migrate About content**

Create `content/about.md` with front matter fields `title`, `description`, `layout`, `name`, `bio`, `skills`, and `contacts`. Copy the existing bio and skills from `src/content/about.json`; preserve empty or placeholder contact URLs only if they are intentionally replaced with real values during implementation.

- [ ] **Step 3: Convert experience entries to pages**

Create one file per existing entry under `content/experience/`, using front matter fields `title`, `company`, `period`, `weight`, and `technologies`, followed by the existing description. Set lower `weight` for the newest entry so Hugo renders reverse chronology deterministically.

- [ ] **Step 4: Convert project entries to pages**

Create one file per existing project under `content/projects/`, using `title`, `description`, `technologies`, `link`, `featured`, and `weight`. Preserve the current Cloud Dashboard and CLI Tool facts and leave missing links absent rather than fabricating URLs.

- [ ] **Step 5: Migrate blog posts**

Move each `src/content/posts/*.md` file to `content/blog/*.md`. Keep the Markdown body, normalize front matter to `title`, `date`, `description`, `summary`, and `tags`, and ensure dates parse as ISO dates. Add `draft = false` explicitly to migrated posts.

- [ ] **Step 6: Build the content model locally**

Run:

```bash
hugo --minify
```

Expected: Hugo generates `public/` without template or front-matter errors. Do not delete the legacy source yet if Hugo is not installed; install the pinned Extended release used by the workflow first.

- [ ] **Step 7: Commit the content migration**

```bash
git add hugo.toml .gitignore content
git commit -m "feat: migrate site content to hugo"
```

## Task 2: Implement Shared Layout and Navigation

**Files:** Create `layouts/_default/baseof.html`, `layouts/partials/head.html`, `layouts/partials/header.html`, `layouts/partials/nav.html`, `layouts/partials/footer.html`, and `static/favicon.svg`.

- [ ] **Step 1: Add the document shell**

`baseof.html` must define `<!doctype html>`, `lang`, viewport, title, description, canonical URL, Open Graph fields, favicon, `/css/site.css`, the shared header, `<main>`, shared footer, and `/js/site.js`. Use Hugo escaping helpers for all content-derived values.

- [ ] **Step 2: Add accessible navigation**

The header must include a text `HF` brand link, desktop links for About, Experience, Projects, and Blog, a mobile menu button with `aria-expanded` and `aria-controls`, and a mobile navigation region. Mark the current page with `aria-current="page"` and a visible active style.

- [ ] **Step 3: Add contact footer**

Render only configured contact links. External links must include `target="_blank"` and `rel="noopener noreferrer"`; email links must use `mailto:`. Do not render empty placeholder URLs as clickable links.

- [ ] **Step 4: Add favicon and metadata defaults**

Copy the existing SVG favicon into `static/favicon.svg`. Use page-specific description and image metadata when present, falling back to site parameters.

- [ ] **Step 5: Verify shared layout output**

Run `hugo --minify` and inspect generated HTML for a title, canonical URL, viewport, navigation links, footer links, and favicon on the homepage.

- [ ] **Step 6: Commit the shared shell**

```bash
git add layouts/_default/baseof.html layouts/partials static/favicon.svg
git commit -m "feat: add hugo site shell and navigation"
```

## Task 3: Build Page Templates and Content Components

**Files:** Create the page and partial templates listed in the File Map.

- [ ] **Step 1: Implement the homepage**

Render the homepage in this order: `SYSTEM ONLINE` status label, name and positioning, two primary links, current-focus/status panels, featured projects sorted by weight, and the newest three non-draft blog posts. Use `where`, `sort`, and `first` so the page remains data-driven as content grows.

- [ ] **Step 2: Implement About, Experience, and Projects**

Use a shared page heading partial. Render About body and skills, Experience as reverse-chronological entries with company/period metadata and technology tags, and Projects as a responsive card grid with optional links. Do not emit empty links.

- [ ] **Step 3: Implement Blog list and post pages**

The blog list must render newest-first posts with summary, date, tags, and links. The single-post template must render title, date, tags, `Content`, previous/next navigation where available, and a back-to-blog link.

- [ ] **Step 4: Implement tag pages, RSS, robots, and 404**

Use Hugo taxonomy templates for `/tags/<tag>/`, generate RSS for the blog section, serve `robots.txt` with the sitemap URL, and provide a styled 404 page with a working home link.

- [ ] **Step 5: Verify route coverage**

Run:

```bash
hugo --minify
test -f public/index.html
test -f public/about/index.html
test -f public/experience/index.html
test -f public/projects/index.html
test -f public/blog/index.html
test -f public/404.html
test -f public/robots.txt
test -f public/sitemap.xml
```

Expected: all commands exit successfully, with migrated posts and tag routes present under `public/blog/` and `public/tags/`.

- [ ] **Step 6: Commit page templates**

```bash
git add layouts
git commit -m "feat: add hugo page templates"
```

## Task 4: Implement the Terminal-Laboratory Theme

**Files:** Create `static/css/site.css` and `static/js/site.js`.

- [ ] **Step 1: Add design tokens and base styles**

Define CSS custom properties for `#0B0F14`, `#E8EEF2`, `#8A9AA8`, `#39D0B6`, `#6EA8FE`, borders, spacing, content widths, and transitions. Use a readable sans-serif stack for prose and Space Mono/system monospace for labels, navigation, metadata, and code. Include a visible `:focus-visible` treatment.

- [ ] **Step 2: Add responsive layout styles**

Implement desktop header, hero panels, project grid, article column, timeline/list sections, and footer. At `max-width: 768px`, switch to one column, show the menu button, hide desktop navigation, prevent horizontal overflow, and maintain touch-friendly controls.

- [ ] **Step 3: Style Markdown and code**

Style headings, paragraphs, lists, links, inline code, fenced code blocks, blockquotes, tables, and images. Ensure long code and URLs scroll or wrap without expanding the viewport.

- [ ] **Step 4: Add progressive menu behavior**

`site.js` must toggle a `menu-open` state, update `aria-expanded`, close on Escape, close after navigation, and avoid running animation-dependent behavior when `prefers-reduced-motion: reduce` is enabled. The page must remain usable if JavaScript is unavailable.

- [ ] **Step 5: Verify responsive behavior**

Run the Hugo build, serve `public/` locally, and inspect at desktop and mobile viewport widths. Confirm no horizontal scrollbar, clipped headings, inaccessible menu controls, or low-contrast text.

- [ ] **Step 6: Commit the theme**

```bash
git add static/css/site.css static/js/site.js
git commit -m "feat: add terminal laboratory theme"
```

## Task 5: Remove the Legacy Node Pipeline

**Files:** Delete `build.js`, `package.json`, `package-lock.json`, `src/`, and checked-in `dist/` only after Tasks 1-4 pass.

- [ ] **Step 1: Confirm Hugo replaces every legacy output**

Run `hugo --minify`, enumerate all generated routes, and compare the migrated content list against `src/content/`. Confirm no required article, project, experience entry, tag, or asset is missing.

- [ ] **Step 2: Remove legacy files**

Delete the old Node build script, package manifests, `src/` templates/content/styles/scripts, and checked-in `dist/`. Do not delete `public/` from the working tree if it is useful for local verification, but keep it ignored and never deploy it as committed source.

- [ ] **Step 3: Verify a clean Hugo-only checkout**

From a clean checkout with Hugo installed, run `hugo --minify`. Expected: the build succeeds without `npm install`, Node.js, or files from `src/`.

- [ ] **Step 4: Commit the removal**

```bash
git add -A
git commit -m "refactor: remove legacy node build pipeline"
```

## Task 6: Add GitHub Actions Build and Deployment

**Files:** Create `.github/workflows/deploy.yml` and update `.gitignore` if needed.

- [ ] **Step 1: Define workflow triggers and permissions**

Use `push` for `main` and `workflow_dispatch`. Grant only `contents: read`. Pin the Hugo Extended version and action major versions; do not use floating shell installers.

- [ ] **Step 2: Build the site**

The workflow must checkout the repository, install Hugo Extended, run `hugo --minify`, and fail on a build error. Upload `public/` as a short-lived artifact only if needed for debugging; do not commit generated files.

- [ ] **Step 3: Configure SSH safely**

Read `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` from GitHub Secrets. Write the key through the action's supported secret input or a temporary file with mode `600`; never interpolate secrets into log messages or command text. Pin the server host key in a secret or checked-in known-hosts value after verifying it out of band.

- [ ] **Step 4: Back up and upload atomically**

Before upload, execute a remote script that creates `${DEPLOY_PATH}.backup-<UTC timestamp>`. Upload the generated files to a temporary release directory, verify `index.html` exists, then replace the document root contents without touching web-server configuration. Preserve the previous backup for rollback.

- [ ] **Step 5: Add post-deploy smoke checks**

After upload, run `curl --fail --silent --show-error --location --max-time 20 https://haoyong.fan/` and check the primary page URLs. Fail the workflow if HTTPS does not return success.

- [ ] **Step 6: Commit the workflow**

```bash
git add .github/workflows/deploy.yml .gitignore
git commit -m "ci: deploy hugo site to server"
```

## Task 7: Inspect Server and Perform First Deployment

**Files:** No repository source changes unless the inspected document root requires a documented secret/configuration update.

- [ ] **Step 1: Establish key-based access**

Generate or select a dedicated deployment SSH key locally. Add only the public key to the server's authorized keys and store the private key in the repository's GitHub Actions Secrets as `DEPLOY_SSH_KEY`. Do not store or repeat the root password in repository files, shell history, workflow logs, or documentation.

- [ ] **Step 2: Inspect the server before changing it**

Using SSH, record the active web server, HTTPS certificate configuration, document root, running services, disk space, and current site response. Confirm the target directory and that changing only its static contents will not affect unrelated applications.

- [ ] **Step 3: Configure GitHub Secrets**

Set `DEPLOY_HOST=149.88.88.16`, the confirmed deployment user, the confirmed document root as `DEPLOY_PATH`, and the verified private key as `DEPLOY_SSH_KEY`. Prefer a dedicated non-root deployment user with write access limited to the document root. Treat the root password as an emergency-only credential and rotate it after key access is confirmed.

- [ ] **Step 4: Run the workflow manually**

Use GitHub Actions `workflow_dispatch`. Confirm the Hugo build, SSH connection, remote backup, upload, and HTTPS smoke checks all pass.

- [ ] **Step 5: Verify the deployed site**

Check `https://haoyong.fan/`, About, Experience, Projects, Blog, at least one post, one tag page, RSS, and a missing URL. Check desktop and mobile rendering with a browser and inspect the browser console for errors.

- [ ] **Step 6: Document rollback**

Record the generated backup directory and the exact remote command to restore it. If smoke checks fail, restore the previous backup before investigating application content.

## Task 8: Final Verification and Handoff

- [ ] **Step 1: Run repository checks**

```bash
hugo --minify
git status --short
```

Expected: build succeeds; only intentionally ignored generated files remain untracked, and no secret-like values appear in tracked files.

- [ ] **Step 2: Check generated links and assets**

Use a local static server and crawl the generated HTML for broken root-relative assets and missing internal pages. Confirm canonical URLs resolve under `https://haoyong.fan/`.

- [ ] **Step 3: Check GitHub Actions security**

Review the workflow and one successful run. Confirm the SSH key, host, and path are sourced from secrets, logs do not print secret values, and the workflow has read-only repository permissions.

- [ ] **Step 4: Commit final documentation if needed**

Update the repository README with the Markdown content workflow, local Hugo preview command, required GitHub Secrets names, and rollback procedure. Do not include secret values or private server details beyond the public hostname.

- [ ] **Step 5: Commit the handoff documentation**

```bash
git add README.md
git commit -m "docs: document hugo publishing workflow"
```
