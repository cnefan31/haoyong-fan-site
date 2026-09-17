# Task 6 Atomic Deployment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hugo deployment back up first, upload into a versioned release, atomically activate through a symlink, and retain only the active release plus five newest timestamped artifacts.

**Architecture:** Keep `DEPLOY_PATH` as the web-server's stable path. A single remote script validates and backs up the current path before upload; a later remote script validates the uploaded release, swaps a temporary symlink into place with `mv -Tf`, and prunes only matching release/backup directories after activation. First deployment renames a safe existing real directory into its preserved backup and points the stable path at that backup before upload, without changing web-server configuration.

**Tech Stack:** GitHub Actions YAML, Bash on the remote host, SSH, rsync, Hugo.

---

### Task 1: Replace remote preparation with backup-first layout setup

**Files:**
- Modify: `.github/workflows/deploy.yml:51-83`

- [ ] **Step 1: Update the preparation script**

  Pass `DEPLOY_PATH`, a stable timestamped `release_id`, and the remote script. Validate that the path is absolute and not `/`; reject regular files, dangling symlinks, and unsupported path types. For an existing real directory, rename it to `${DEPLOY_PATH}.backup-<timestamp>-<release_id>` and point `DEPLOY_PATH` at that backup before creating `${DEPLOY_PATH}.release-<release_id>`. For an existing symlink, require a directory target and copy that target into its backup. For a missing path, validate its parent directory and create the release parent layout. Emit the release path only after the backup and release directory are ready.

- [ ] **Step 2: Run shell syntax validation on the extracted remote script shape**

  Use `bash -n` against the workflow's embedded shell after extraction or inspect the resulting YAML run blocks manually; the preparation script must use `set -euo pipefail` and quote all paths.

### Task 2: Upload and atomically activate the validated release

**Files:**
- Modify: `.github/workflows/deploy.yml:85-140`

- [ ] **Step 1: Keep rsync pointed only at the versioned release**

  Preserve strict SSH options and run rsync against `${DEPLOY_PATH}.release-${release_id}/`; never use `DEPLOY_PATH` as the rsync destination.

- [ ] **Step 2: Replace backup-and-copy activation**

  Require `${release_dir}/index.html`, create a unique temporary symlink beside `DEPLOY_PATH` pointing to the release, validate the link target and index, then atomically replace `DEPLOY_PATH` with `mv -Tf`. On first deployment this replaces the preserved real directory only after the release is valid. Fail before activation if the stable path changes to an unsupported type. Remove the temporary symlink only after a successful swap.

- [ ] **Step 3: Add retention pruning after successful activation**

  Enumerate only siblings matching the exact `${DEPLOY_PATH}.release-*` and `${DEPLOY_PATH}.backup-*` patterns. Keep the active release and the five newest timestamped artifacts, then remove older matching directories. Do not prune before activation and do not touch unrelated names, files, or web-server configuration.

### Task 3: Document first-time setup and layout

**Files:**
- Modify: `.github/workflows/deploy.yml` comments near the remote preparation and activation steps

- [ ] **Step 1: Document required server setup**

  Explain that the first deployment requires an existing absolute document-root path or a safely creatable missing path, writable sibling release/backup locations, and a web server already configured to serve `DEPLOY_PATH`. State that the workflow changes only the path entry and never edits web-server configuration. Document the release/backup naming and rollback implication without adding secrets.

- [ ] **Step 2: Check secret and host-key handling**

  Preserve `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, strict host-key checking, and the existing secret comments. Ensure no secret is interpolated into a remote command or printed.

### Task 4: Verify and commit

**Files:**
- Verify: `.github/workflows/deploy.yml`
- Verify: `docs/superpowers/specs/2026-09-18-task-6-deployment-activation-design.md`

- [ ] **Step 1: Run repository checks**

  Run YAML parsing/static checks available in the repository, shell syntax/static checks for workflow shell, and `git diff --check`. Also run `hugo --minify` if the local Hugo binary is available.

- [ ] **Step 2: Inspect the final diff and status**

  Confirm only the intended workflow and design/plan documentation changed, and confirm the workflow's sequence is backup, upload, validate, activate, prune, smoke-check.

- [ ] **Step 3: Commit the implementation**

  Run:

  ```bash
  git add .github/workflows/deploy.yml docs/superpowers/plans/2026-09-18-task-6-atomic-deployment-fix.md
  git commit -m "fix(ci): activate hugo releases atomically"
  ```

  Report the resulting commit SHA and the verified first-deployment and rollback behavior.
