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

The workflow retains the active release and the five newest timestamped release or backup artifacts. To roll back, log in through the approved deployment access and choose either a retained release under `${DEPLOY_PATH}.releases/release-*` or a retained backup at `${DEPLOY_PATH}.backup-*`. Backups are not stored under the release root. Manual rollback must acquire the same `${DEPLOY_PATH}.deploy.lock` mutex used by the workflow and release it on every exit. A backup must first be copied into a new validated release directory, then activated with a temporary symlink and atomic `mv -Tf`:

```bash
DEPLOY_PATH=/path/to/document-root
RELEASE_ROOT="${DEPLOY_PATH}.releases"
test -n "$DEPLOY_PATH"
test "${DEPLOY_PATH#/}" != "$DEPLOY_PATH"
test "$DEPLOY_PATH" != "/"
LOCK_DIR="${DEPLOY_PATH}.deploy.lock"
LOCK_OWNER="manual-rollback-$(date -u +%Y%m%dT%H%M%SZ)-$$"
test ! -L "$LOCK_DIR"
if ! mkdir -m 700 -- "$LOCK_DIR" 2>/dev/null; then
  printf '%s\n' "deployment lock is already held: $LOCK_DIR" >&2
  exit 1
fi
cleanup_lock() { rm -rf -- "$LOCK_DIR"; }
trap cleanup_lock EXIT
printf '%s\nacquired_utc=%s\nhost=%s\n' "$LOCK_OWNER" "$(date -u +%Y%m%dT%H%M%SZ)" "$(hostname)" > "$LOCK_DIR/owner"

SOURCE="${DEPLOY_PATH}.backup-<timestamp>-<run>-<attempt>"
BACKUP_SOURCE="$SOURCE"
# To use a retained release directly instead, set SOURCE to its release-* path
# and set BACKUP_SOURCE="".

test -d "$RELEASE_ROOT"
test ! -L "$RELEASE_ROOT"
RELEASE_ROOT_REAL="$(readlink -f -- "$RELEASE_ROOT")"
test -n "$RELEASE_ROOT_REAL"
test "$RELEASE_ROOT_REAL" != "/"

if test -n "$BACKUP_SOURCE"; then
  backup_parent_configured="$(dirname -- "$DEPLOY_PATH")"
  backup_name="$(basename -- "$BACKUP_SOURCE")"
  test "$(dirname -- "$BACKUP_SOURCE")" = "$backup_parent_configured"
  case "$backup_name" in
    "$(basename -- "$DEPLOY_PATH").backup-"*) ;;
    *)
      printf '%s\n' "refusing backup with invalid name: $backup_name" >&2
      exit 1
      ;;
  esac
  test -d "$BACKUP_SOURCE"
  test ! -L "$BACKUP_SOURCE"
  test -f "$BACKUP_SOURCE/index.html"
  test ! -L "$BACKUP_SOURCE/index.html"
  backup_parent="$(readlink -f -- "$(dirname -- "$DEPLOY_PATH")")"
  backup_real="$(readlink -f -- "$BACKUP_SOURCE")"
  deploy_name="$(basename -- "$DEPLOY_PATH")"
  case "$backup_real/" in
    "$backup_parent/$deploy_name.backup-"*) ;;
    *)
      printf '%s\n' "refusing external backup path: $backup_real" >&2
      exit 1
      ;;
  esac
  SOURCE="$(mktemp -d "${RELEASE_ROOT}/release-rollback-XXXXXX")"
  cp -a -- "$BACKUP_SOURCE"/. "$SOURCE"/
fi

source_name="$(basename -- "$SOURCE")"
test "$(dirname -- "$SOURCE")" = "$RELEASE_ROOT"
case "$source_name" in
  release-*) ;;
  *)
    printf '%s\n' "refusing rollback source with invalid name: $source_name" >&2
    exit 1
    ;;
esac
SOURCE_REAL="$(readlink -f -- "$SOURCE")"
test -n "$SOURCE_REAL"
test -d "$SOURCE"
test ! -L "$SOURCE"
test "$SOURCE_REAL" != "$RELEASE_ROOT_REAL"
case "$SOURCE_REAL/" in
  "$RELEASE_ROOT_REAL"/*) ;;
  *)
    printf '%s\n' "refusing external rollback source: $SOURCE_REAL" >&2
    exit 1
    ;;
esac
test -f "$SOURCE/index.html"
test ! -L "$SOURCE/index.html"

temporary_link="${DEPLOY_PATH}.rollback-$$"
test ! -e "$temporary_link"
test ! -L "$temporary_link"
ln -s -- "$SOURCE" "$temporary_link"
mv -Tf -- "$temporary_link" "$DEPLOY_PATH"
```

Verify the primary HTTPS routes after rollback. Do not delete unrelated server files or web-server configuration.
