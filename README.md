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
- Before enabling GitHub Actions, create `${DEPLOY_PATH}.releases`, create an initial real release directory with the current site, and set `DEPLOY_PATH` to a symlink targeting that release during a maintenance window. The workflow requires this baseline and never converts a real directory or creates a missing live path.
- Ensure the deployment user can create and write the sibling `${DEPLOY_PATH}.releases` root and timestamped `${DEPLOY_PATH}.backup-*` paths.
- Ensure an existing `DEPLOY_PATH` symlink resolves to a real directory inside `${DEPLOY_PATH}.releases`. External, dangling, regular-file, and non-directory paths are rejected without modification.
- Use a dedicated deployment user and limit its access to the site deployment paths.

The one-time baseline setup is an operator maintenance task. If `DEPLOY_PATH` is currently a real directory, schedule a brief maintenance window and run an equivalent setup with the approved deployment access:

```bash
set -euo pipefail
DEPLOY_PATH=/path/to/document-root
RELEASE_ROOT="${DEPLOY_PATH}.releases"
BACKUP="${DEPLOY_PATH}.backup-initial-$(date -u +%Y%m%dT%H%M%SZ)"
BASELINE="${RELEASE_ROOT}/release-initial"

test -d "$DEPLOY_PATH"
test ! -L "$DEPLOY_PATH"
mkdir -m 755 -- "$RELEASE_ROOT"
mkdir -m 755 -- "$BACKUP"
cp -a -- "$DEPLOY_PATH"/. "$BACKUP"/
mkdir -m 755 -- "$BASELINE"
cp -a -- "$DEPLOY_PATH"/. "$BASELINE"/
mv -- "$DEPLOY_PATH" "$BACKUP"
ln -s -- "$BASELINE" "$DEPLOY_PATH"
```

Verify `DEPLOY_PATH` resolves to `BASELINE` and contains a regular `index.html` before enabling the workflow. After this setup exists, every workflow deployment copies the active in-root release to a timestamped backup, uploads to a new release directory, and atomically switches the live symlink. A real directory or missing `DEPLOY_PATH` fails before mutation.

## Rollback

The workflow retains the active release and the five newest timestamped release or backup artifacts. The deployment lock uses a 30-minute lease with owner metadata; a lock older than the lease is atomically quarantined and recovered, while active or malformed locks fail safely. To roll back, log in through the approved deployment access and choose either a retained release under `${DEPLOY_PATH}.releases/release-*` or a retained backup at `${DEPLOY_PATH}.backup-*`. Backups are not stored under the release root. Manual rollback must acquire the same `${DEPLOY_PATH}.deploy.lock` mutex, apply the same lease/recovery rule, and release it on every exit. A backup must first be copied into a new validated release directory, then activated with a temporary symlink and atomic `mv -Tf`:

```bash
set -euo pipefail
DEPLOY_PATH=/path/to/document-root
RELEASE_ROOT="${DEPLOY_PATH}.releases"
test -n "$DEPLOY_PATH"
test "${DEPLOY_PATH#/}" != "$DEPLOY_PATH"
test "$DEPLOY_PATH" != "/"
LOCK_DIR="${DEPLOY_PATH}.deploy.lock"
LOCK_OWNER="manual-rollback-$(date -u +%Y%m%dT%H%M%SZ)-$$"
LOCK_LEASE_SECONDS=1800
test ! -L "$LOCK_DIR"
if ! mkdir -m 700 -- "$LOCK_DIR" 2>/dev/null; then
  test -d "$LOCK_DIR"
  test ! -L "$LOCK_DIR"
  test -f "$LOCK_DIR/owner"
  IFS= read -r held_owner < "$LOCK_DIR/owner"
  IFS= read -r acquired_epoch < <(sed -n '2p' "$LOCK_DIR/owner")
  case "$acquired_epoch" in
    ''|*[!0-9]*)
      printf '%s\n' "deployment lock has invalid lease metadata: $held_owner" >&2
      exit 1
      ;;
  esac
  lock_age=$(($(date +%s) - acquired_epoch))
  if ((lock_age < 0 || lock_age <= LOCK_LEASE_SECONDS)); then
    printf '%s\n' "deployment lock is active: $held_owner" >&2
    exit 1
  fi
  recovery_dir="${LOCK_DIR}.expired-$(date +%s)-$$"
  test ! -e "$recovery_dir"
  mv -- "$LOCK_DIR" "$recovery_dir"
  rm -rf -- "$recovery_dir"
  mkdir -m 700 -- "$LOCK_DIR"
fi
cleanup_lock() { rm -rf -- "$LOCK_DIR"; }
trap cleanup_lock EXIT
printf '%s\n%s\n%s\nlease_seconds=%s\n' "$LOCK_OWNER" "$(date +%s)" "$(hostname)" "$LOCK_LEASE_SECONDS" > "$LOCK_DIR/owner"

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
