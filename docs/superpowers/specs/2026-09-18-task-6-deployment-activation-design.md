# Task 6 Deployment Activation Design

## Goal

Deploy Hugo output without writing into the live document root, while preserving rollback and making activation atomic.

## Remote Layout

`DEPLOY_PATH` remains the stable path configured in the web server. Deployment artifacts live beside it:

- `${DEPLOY_PATH}.release-<run>-<attempt>` contains an uploaded release.
- `${DEPLOY_PATH}.backup-<UTC>-<run>-<attempt>` contains a rollback copy of the previous document root.

The workflow only manages these exact prefixed directories and never removes unrelated server files or configuration.

## Deployment Flow

The remote workflow first validates `DEPLOY_PATH` and creates a timestamped backup of the current document root before any upload. Existing real directories are renamed as backups, while existing symlink targets are copied as backups so the active release remains available. An existing symlink must resolve to a directory; unsupported path types, dangling symlinks, and unsafe paths fail without modification. On first deployment, a real document-root directory is preserved as the backup and the stable path temporarily points to that backup until the uploaded release is validated.

The generated site is uploaded to a fresh versioned release directory. For a first deployment with a real document root, the workflow renames that directory to its backup and temporarily points the stable path at the backup so the old site remains available while the release uploads. The workflow requires `index.html`, creates a temporary symlink to that release, and atomically swaps the stable path using `mv -Tf`. The web-server configuration is not changed.

After successful activation, retention keeps the active release and the five newest timestamped release/backup directories. Only matching deployment artifacts older than that retention set are pruned.

## Verification

The workflow continues to use a temporary SSH key with strict known-host verification and performs HTTPS smoke checks for the primary routes. YAML parsing, static checks, shell syntax checks, and `git diff --check` verify the workflow before commit.
