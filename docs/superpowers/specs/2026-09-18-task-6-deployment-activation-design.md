# Task 6 Deployment Activation Design

## Goal

Deploy Hugo output without writing into the live document root, while preserving rollback and making activation atomic.

## Remote Layout

`DEPLOY_PATH` remains the stable path configured in the web server. Deployment artifacts live in its sibling release root and backup directories:

- `${DEPLOY_PATH}.releases/release-<timestamp>-<run>-<attempt>` contains an uploaded release.
- `${DEPLOY_PATH}.backup-<UTC>-<run>-<attempt>` contains a rollback copy of the previous document root.

The workflow only manages these exact prefixed directories and never removes unrelated server files or configuration.

## Deployment Flow

The remote workflow first validates `DEPLOY_PATH` and creates a timestamped backup of the current document root before any upload. Existing real directories are renamed as backups, while existing symlink targets are copied as backups so the active release remains available. An existing symlink must resolve to a directory; unsupported path types, dangling symlinks, and unsafe paths fail without modification. On first deployment, the existing real document-root directory is preserved as a timestamped backup, copied into an in-root `release-<timestamp>-<run>-<attempt>-previous` baseline, and `DEPLOY_PATH` is switched to that baseline through the symlink layout before the uploaded release is validated.

The generated site is uploaded to a fresh versioned release directory. For a first deployment with a real document root, the workflow preserves the original directory as the backup and points the stable path at the in-root `release-<timestamp>-<run>-<attempt>-previous` baseline so the old site remains available while the release uploads. The workflow requires `index.html`, creates a temporary symlink to that release, and atomically swaps the stable path using `mv -Tf`. The web-server configuration is not changed.

After successful activation, retention keeps the active release and the five newest timestamped release/backup directories. Only matching deployment artifacts older than that retention set are pruned.

## Verification

The workflow continues to use a temporary SSH key with strict known-host verification and performs HTTPS smoke checks for the primary routes. YAML parsing, static checks, shell syntax checks, and `git diff --check` verify the workflow before commit.
