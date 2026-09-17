# haoyong.fan Redesign and GitHub Deployment Spec

## Goal

Redesign haoyong.fan as a balanced personal homepage for projects, experience, and writing. The visual direction combines a technical terminal aesthetic with a modern laboratory feel. Content will be authored as Markdown in `cnefan31/haoyong-fan-site`, built by Hugo in GitHub Actions, and deployed as static files to the server behind `haoyong.fan`.

## Product Direction

The site should quickly answer three questions: who Haoyong Fan is, what he builds, and what he is currently exploring. The homepage is the primary entry point, with independent About, Experience, Projects, Blog, and tag pages for deeper browsing.

Existing factual content is retained. Descriptions may be edited for clarity and hierarchy, but the implementation must not invent employers, projects, achievements, or contact details.

## Visual Language

- Aesthetic: terminal laboratory; technical, calm, structured, and readable.
- Background: `#0B0F14`.
- Primary text: `#E8EEF2`.
- Secondary text: `#8A9AA8`.
- Primary accent: `#39D0B6`.
- Secondary accent: `#6EA8FE`.
- Typography: Space Mono for navigation, labels, code, and metadata; a highly readable sans-serif system fallback for Chinese body copy.
- Layout: visible structure lines, restrained borders, deliberate spacing, no glassmorphism or decorative gradients.
- Motion: short transitions for hover, menu, and status indicators only; no scroll choreography or blocking animation.

## Page Architecture

### Homepage

The homepage contains a branded navigation header, a hero with name and positioning, a system-status/current-focus panel, calls to action for projects and writing, featured projects, and latest posts. It should be useful without requiring a second page.

### About

Personal introduction, technical focus, working approach, skills, and contact links.

### Experience

Reverse-chronological entries with role, organization, dates, responsibilities, impact, and relevant technologies.

### Projects

Featured project cards with purpose, outcome or status, technology tags, and external links where available.

### Blog

Post listing with title, date, summary, reading link, and tag filters. Post pages prioritize Chinese readability, code blocks, headings, links, quotes, and metadata.

### Supporting Pages

Tag pages, RSS feed, SEO/Open Graph metadata, and a custom 404 page are generated as static output.

## Content Model

Content lives in the repository as Markdown with front matter:

```text
content/
  _index.md
  about.md
  experience/*.md
  projects/*.md
  blog/*.md
```

Blog front matter includes `title`, `date`, `description`, and `tags`. Hugo templates own presentation; content authors do not need to edit HTML.

## Technical Architecture

- Generator: Hugo Extended.
- Runtime: static HTML, CSS, JavaScript only.
- Styling: custom theme under `layouts/` and `static/css/`; no general-purpose theme dependency.
- JavaScript: small progressive-enhancement layer for mobile navigation and nonessential status interactions.
- Code highlighting: Hugo's built-in Markdown/code rendering, styled by the site theme.
- Build output: Hugo's generated `public/` directory; generated output is not committed.
- Removed legacy pieces: the existing `build.js`, Node.js Markdown pipeline, old templates, `node_modules`, and checked-in `dist/` are no longer deployment dependencies.

## Repository Layout

```text
haoyong-fan-site/
  content/
  layouts/
  static/css/
  static/js/
  static/images/
  assets/
  hugo.toml
  .github/workflows/deploy.yml
```

## GitHub Actions Deployment

The workflow in `.github/workflows/deploy.yml` runs on pushes to `main` and supports manual dispatch. It will:

1. Check out the repository.
2. Install a pinned Hugo Extended version.
3. Run `hugo --minify`.
4. Authenticate with an SSH private key stored in GitHub Actions Secrets.
5. Back up the current remote site directory with a timestamp.
6. Upload the generated static files to the configured remote directory.
7. Verify `https://haoyong.fan` returns a successful response.

Required secrets/configuration are `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_PATH`. Secrets must never appear in source files, logs, committed documentation, or workflow arguments. The supplied root password is not used by the workflow and must not be stored in GitHub.

The first deployment must inspect the server's existing web server, document root, HTTPS setup, and active services before changing anything. Existing site files are backed up before replacement. The workflow must not overwrite unrelated server configuration.

## Responsive Behavior

- Desktop: fixed or sticky header, structured hero panels, project grid, and readable article column.
- Mobile: single-column layout, compact menu, touch-friendly controls, no horizontal overflow, and readable Chinese line length.
- All primary navigation, project links, article links, and contact links must remain keyboard accessible.

## Verification

Before deployment, verify:

- `hugo --minify` completes without warnings that affect output.
- Homepage, About, Experience, Projects, Blog, post, tag, RSS, and 404 routes are generated.
- Internal links and asset paths work from the domain root.
- Markdown code blocks and Chinese typography render correctly.
- Desktop and mobile layouts have no overflow or clipped content.
- GitHub Actions logs do not expose secrets.
- The deployed HTTPS site returns successful responses for the primary routes.

## Scope Boundaries

This phase does not add a CMS, database, authentication, comments, analytics, or runtime API. Content changes are made through Markdown commits in the GitHub repository. Server changes are limited to the static site deployment path and the minimum SSH/web-server configuration required to serve the generated files.
