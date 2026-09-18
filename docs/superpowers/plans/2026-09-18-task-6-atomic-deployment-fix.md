# Task 6 Atomic Deployment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hugo deployment back up first, upload into a versioned release, atomically activate through a symlink, and retain only the active release plus five newest timestamped artifacts.

**Architecture:** Keep `DEPLOY_PATH` as the web-server's stable symlink, created by an operator before CI deployment. A single remote script validates and backs up the current in-root release before upload; a later remote script validates the uploaded release, swaps a temporary symlink into place with `mv -Tf`, and prunes only matching release/backup directories after activation. A remote owner-metadata lock with a 30-minute lease spans preparation through smoke checks; the workflow never converts a real directory or creates a missing live path.

**Tech Stack:** GitHub Actions YAML, Bash on the remote host, SSH, rsync, Hugo.

---

### Task 1: Replace remote preparation with backup-first layout setup

**Files:**
- Modify: `.github/workflows/deploy.yml:51-83`

- [ ] **Step 1: Update the preparation script**

  Pass `DEPLOY_PATH`, a stable timestamped `release_id`, and the remote script. Require `DEPLOY_PATH` to be an existing symlink into the existing `${DEPLOY_PATH}.releases` root; reject real directories, missing paths, dangling symlinks, and unsupported targets before any backup or release mutation. Copy the active in-root release to `${DEPLOY_PATH}.backup-<timestamp>-<release_id>`, then create the new `${DEPLOY_PATH}.releases/release-<timestamp>-<run>-<attempt>` directory. Emit the release path only after the backup and release directory are ready.

- [ ] **Step 2: Run shell syntax validation on the extracted remote script shape**

  Use `bash -n` against the workflow's embedded shell after extraction or inspect the resulting YAML run blocks manually; the preparation script must use `set -euo pipefail` and quote all paths.

### Task 2: Upload and atomically activate the validated release

**Files:**
- Modify: `.github/workflows/deploy.yml:85-140`

- [ ] **Step 1: Keep rsync pointed only at the versioned release**

  Preserve strict SSH options and run rsync against `${DEPLOY_PATH}.releases/release-${release_id}/`; never use `DEPLOY_PATH` as the rsync destination.

- [ ] **Step 2: Replace backup-and-copy activation**

  Require `${DEPLOY_PATH}.releases/release-${release_id}/index.html`, create a unique temporary symlink beside the already-prepared `DEPLOY_PATH` symlink, validate the link target and index, then atomically replace `DEPLOY_PATH` with `mv -Tf`. Fail before activation if the stable path changes to an unsupported type. Remove the temporary symlink only after a successful swap.

- [ ] **Step 3: Add retention pruning after successful activation**

  Enumerate only `${DEPLOY_PATH}.releases/release-*` and sibling `${DEPLOY_PATH}.backup-*` artifacts. Keep the active release and the five newest timestamped artifacts, then remove older matching directories. Do not prune before activation and do not touch unrelated names, files, or web-server configuration.

### Task 3: Document first-time setup and layout

**Files:**
- Modify: `.github/workflows/deploy.yml` comments near the remote preparation and activation steps

- [ ] **Step 1: Document required server setup**

  Explain the one-time server setup: preserve any existing real document root as a timestamped backup, create an initial release under `${DEPLOY_PATH}.releases`, and atomically point `DEPLOY_PATH` at that release. Require writable release/backup/lock siblings and a web server already configured to serve `DEPLOY_PATH`; state that the workflow rejects a real or missing path and never edits web-server configuration. Document the 30-minute lock lease and manual rollback lock requirement without adding secrets.

- [ ] **Step 2: Check secret and host-key handling**

  Preserve `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, strict host-key checking, and the existing secret comments. Ensure no secret is interpolated into a remote command or printed.

### Task 4: Verify and commit

**Files:**
- Verify: `.github/workflows/deploy.yml`
- Verify: `docs/superpowers/specs/2026-09-18-task-6-deployment-activation-design.md`

- [ ] **Step 1: Run repository checks**

  Run YAML parsing/static checks available in the repository, shell syntax/static checks for workflow shell, and `git diff --check`. Also run `hugo --minify` if the local Hugo binary is available.

- [ ] **Step 2: Inspect the final diff and status**

  Confirm only the intended workflow and documentation changed, the one-time operator baseline setup is documented, and the workflow's sequence is acquire lock, validate prepared symlink, backup active release, upload, validate, activate, prune, smoke-check, release lock.

- [ ] **Step 3: Commit the implementation**

  Run:

  ```bash
  git add .github/workflows/deploy.yml docs/superpowers/plans/2026-09-18-task-6-atomic-deployment-fix.md
  git commit -m "fix(ci): activate hugo releases atomically"
  ```

  Report the resulting commit SHA and the verified first-deployment and rollback behavior.
