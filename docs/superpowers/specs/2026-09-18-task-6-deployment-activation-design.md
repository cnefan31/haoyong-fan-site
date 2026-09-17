# Task 6 Deployment Activation Design

## Goal

Deploy Hugo output without writing into the live document root, while preserving rollback and making activation atomic.

## Remote Layout

`DEPLOY_PATH` remains the stable path configured in the web server. Deployment artifacts live in its sibling release root and backup directories:

- `${DEPLOY_PATH}.releases/release-<timestamp>-<run>-<attempt>` contains an uploaded release.
- `${DEPLOY_PATH}.backup-<UTC>-<run>-<attempt>` contains a rollback copy of the previous document root.
- `${DEPLOY_PATH}.deploy.lock` serializes deployment and manual rollback, with owner metadata and a 30-minute lease.

The workflow only manages these exact prefixed directories and never removes unrelated server files or configuration.

## Deployment Flow

The remote workflow requires the operator-created `DEPLOY_PATH` symlink to resolve to a directory inside the existing release root before any mutation. Unsupported real directories, missing paths, dangling symlinks, and unsafe targets fail with one-time setup instructions. After validation, the active in-root release is copied to a timestamped backup before upload. The deployment lock is acquired before preparation and held through upload, activation, pruning, and smoke checks; expired leases may be recovered only through owner metadata and an atomic quarantine rename.

The generated site is uploaded to a fresh versioned release directory. The workflow requires `index.html`, creates a temporary symlink to that release, and atomically swaps the stable path using `mv -Tf`. The web-server configuration is not changed. The one-time baseline creation is an operator maintenance task, not a workflow behavior.

After successful activation, retention keeps the active release and the five newest timestamped release/backup directories. Only matching deployment artifacts older than that retention set are pruned.

The deployment lock records its owner, acquisition epoch, host, and 30-minute lease. A live or malformed lock fails safely; an expired lock is atomically renamed to a quarantine path and removed before acquisition is retried. Normal cleanup removes the lock only after verifying its owner.

## Verification

The workflow continues to use a temporary SSH key with strict known-host verification and performs HTTPS smoke checks for the primary routes. YAML parsing, static checks, shell syntax checks, and `git diff --check` verify the workflow before commit.
