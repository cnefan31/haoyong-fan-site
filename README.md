# haoyong.fan

Personal site built with Hugo and deployed as static files through GitHub Actions.

## Local Hugo Commands

Install Hugo Extended locally, then preview the site with drafts:

```bash
hugo server --buildDrafts
```

Build the production output locally:

```bash
hugo --minify
```

The generated site is written to `public/`. It is build output and is not committed.

## Content And Deployment

Markdown content lives in:

- `content/_index.md` for the homepage
- `content/about.md` for the about page
- `content/blog/` for blog posts
- `content/projects/` for projects
- `content/experience/` for experience entries

Pushes to `main` run `.github/workflows/deploy.yml`. The workflow can also be started with GitHub Actions `workflow_dispatch`.

The workflow builds the site with Hugo Extended, backs up the current document root, uploads to a timestamped release under `${DEPLOY_PATH}.releases/`, atomically activates the release through the stable `DEPLOY_PATH` symlink, prunes old artifacts, and checks the public HTTPS routes.

## Required GitHub Secrets

Configure these names in the repository or environment secrets. Do not commit or document their values:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`

`DEPLOY_KNOWN_HOSTS` must contain the server host key verified out of band. The workflow uses strict host-key checking and does not disable verification.

## Server Setup

Before the first deployment:

- Configure the web server to serve the absolute `DEPLOY_PATH` path. The workflow does not edit web-server configuration.
- Make `DEPLOY_PATH` a writable document-root directory, or use the workflow's safe symlink/release layout.
- Ensure the deployment user can create and write the sibling `${DEPLOY_PATH}.releases` root and timestamped `${DEPLOY_PATH}.backup-*` paths.
- Ensure an existing `DEPLOY_PATH` symlink resolves to a real directory inside `${DEPLOY_PATH}.releases`. External, dangling, regular-file, and non-directory paths are rejected without modification.
- Use a dedicated deployment user and limit its access to the site deployment paths.

The first deployment preserves an existing real document root as a timestamped backup and creates an in-root baseline release. Later deployments upload to a new release directory and never sync directly into the live document root.

## Rollback

The workflow retains the active release and the five newest timestamped release or backup artifacts. To roll back, log in through the approved deployment access, choose a retained release or backup, and use a temporary symlink followed by an atomic `mv -Tf`:

```bash
DEPLOY_PATH=/path/to/document-root
RELEASE_ROOT="${DEPLOY_PATH}.releases"
SOURCE="${RELEASE_ROOT}/release-<timestamp>-<run>-<attempt>"
TARGET="$SOURCE"

if [[ "$SOURCE" == *.backup-* ]]; then
  TARGET="${RELEASE_ROOT}/release-rollback-$(date -u +%Y%m%dT%H%M%SZ)"
  install -d -m 755 -- "$TARGET"
  cp -a -- "$SOURCE"/. "$TARGET"/
fi

test -d "$TARGET"
test ! -L "$TARGET"
test -f "$TARGET/index.html"
test ! -L "$TARGET/index.html"

temporary_link="${DEPLOY_PATH}.rollback-$$"
test ! -e "$temporary_link"
test ! -L "$temporary_link"
ln -s -- "$TARGET" "$temporary_link"
mv -Tf -- "$temporary_link" "$DEPLOY_PATH"
```

Verify the primary HTTPS routes after rollback. Do not delete unrelated server files or web-server configuration.
