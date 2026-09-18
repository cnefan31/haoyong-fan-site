# haoyong.fan

范浩雍的个人网站，使用 Hugo 构建，通过 GitHub Actions 部署为纯静态文件。

## 技术栈与设计

- **生成器**：Hugo Extended
- **运行时**：纯静态 HTML / CSS / JavaScript，无框架
- **字体**：Maple Mono CN（等宽字体，含中文），通过 jsDelivr 按需加载分片 woff2
- **主题**：亮色系，深青主色 `#0a7d6f`，配色集中在 `static/css/site.css` 的 CSS 变量中
- **代码高亮**：Hugo 内置 Chroma，样式见 `static/css/chroma.css`

## 本地开发

先在本地安装 Hugo Extended，然后启动带草稿的预览：

```bash
hugo server --buildDrafts
```

构建生产版本：

```bash
hugo --minify
```

产物输出到 `public/`，属于构建结果，不提交到仓库。

## 内容结构

Markdown 内容位置：

- `content/_index.md`：首页
- `content/about.md`：关于页
- `content/blog/`：博客文章（`_index.md` 定义列表页标题）
- `content/projects/`：项目
- `content/experience/`：工作经历

其他约定：

- **标签**：在文章 front matter 的 `tags` 中写英文 slug（保证 URL 干净），中文显示名在 `data/tag_labels.yaml` 中映射
- **图片**：放到 `static/images/` 下，正文中用 `/images/...` 引用
- **文章 slug**：中文标题建议显式设置 `slug`，避免生成百分号编码的 URL

新增文章示例：

```markdown
---
title: "文章标题"
slug: "post-slug"
date: 2026-01-01
description: "文章摘要，会显示在列表中。"
summary: "文章摘要。"
tags:
  - guide
draft: false
---

正文……
```

## 部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`，也可以在 GitHub Actions 中手动触发（`workflow_dispatch`）。

工作流会：用 Hugo Extended 构建站点 → 备份当前文档根目录 → 上传到 `${DEPLOY_PATH}.releases/` 下的时间戳发布目录 → 通过稳定的 `DEPLOY_PATH` 符号链接原子切换 → 清理旧版本 → 检查线上 HTTPS 路由。

## 必需的 GitHub Secrets

在仓库或环境密钥中配置以下名称。不要把值提交到仓库或写进文档：

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`

`DEPLOY_PORT` 是部署主机的 SSH 端口号。当端口不是 22 时，`DEPLOY_KNOWN_HOSTS` 必须使用 `[host]:port` 格式。

`DEPLOY_KNOWN_HOSTS` 必须包含线下核验过的服务器主机密钥。工作流使用严格的主机密钥校验，不会关闭校验。

## 服务器初始化

首次部署之前：

- 配置 Web 服务器指向绝对路径 `DEPLOY_PATH`。工作流不会修改 Web 服务器配置。
- 启用 GitHub Actions 之前，先创建 `${DEPLOY_PATH}.releases`，把当前站点复制成初始发布目录，并在维护窗口内把 `DEPLOY_PATH` 改为指向该发布目录的符号链接。工作流要求这个基线，绝不会把真实目录转换掉，也不会创建缺失的线上路径。
- 确保部署用户对同级 `${DEPLOY_PATH}.releases` 根目录和时间戳目录 `${DEPLOY_PATH}.backup-*` 有创建与写入权限。
- 确保已存在的 `DEPLOY_PATH` 符号链接指向 `${DEPLOY_PATH}.releases` 内的真实目录。外部、悬空、普通文件或非目录路径都会被拒绝且不做任何修改。
- 使用专用部署用户，并把它限制在站点部署路径内。

这一步是一次性的运维操作。如果 `DEPLOY_PATH` 目前是真实目录，请安排一个短暂的维护窗口，用具备部署权限的账号执行等价操作：

```bash
set -euo pipefail
DEPLOY_PATH=/path/to/document-root
RELEASE_ROOT="${DEPLOY_PATH}.releases"
BACKUP="${DEPLOY_PATH}.backup-initial-$(date -u +%Y%m%dT%H%M%SZ)"
BASELINE="${RELEASE_ROOT}/release-initial"

test -d "$DEPLOY_PATH"
test ! -L "$DEPLOY_PATH"
test ! -e "$RELEASE_ROOT"
test ! -e "$BACKUP"
mkdir -m 755 -- "$RELEASE_ROOT"
mkdir -m 755 -- "$BASELINE"
cp -a -- "$DEPLOY_PATH"/. "$BASELINE"/
test -f "$BASELINE/index.html"
test ! -L "$BASELINE/index.html"
mv -T -- "$DEPLOY_PATH" "$BACKUP"
test -f "$BACKUP/index.html"
ln -s -- "$BASELINE" "$DEPLOY_PATH"
test -L "$DEPLOY_PATH"
test "$(readlink -f -- "$DEPLOY_PATH")" = "$(readlink -f -- "$BASELINE")"
```

启用工作流之前，先确认 `DEPLOY_PATH` 指向 `BASELINE` 且包含常规的 `index.html`。完成这一步之后，每次部署都会把当前发布目录复制成时间戳备份，上传到新的发布目录，并原子切换线上符号链接。如果 `DEPLOY_PATH` 是真实目录或不存在，会在做任何修改之前失败。

## 回滚

工作流保留当前发布目录和最新的五个时间戳发布或备份。部署锁使用 30 分钟租约并带 owner 元数据：超过租约的锁会被原子隔离并回收，仍有效或格式错误的锁会安全失败。回滚时，用具备部署权限的账号登录，选择 `${DEPLOY_PATH}.releases/release-*` 下保留的发布目录，或 `${DEPLOY_PATH}.backup-*` 下保留的备份。备份不在发布根目录内。手动回滚必须先获取同一个 `${DEPLOY_PATH}.deploy.lock` 互斥锁，套用相同的租约/回收规则，并在任何退出路径上释放它。备份需要先复制到新的、校验过的发布目录，再用临时符号链接和原子 `mv -Tf` 激活：

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
  test ! -L "$LOCK_DIR/owner"
  test -s "$LOCK_DIR/owner"
  IFS= read -r held_owner < "$LOCK_DIR/owner"
  IFS= read -r acquired_epoch < <(sed -n '2p' "$LOCK_DIR/owner")
  case "$held_owner" in
    ''|*[!A-Za-z0-9_.:-]*)
      printf '%s\n' "deployment lock has invalid owner metadata" >&2
      exit 1
      ;;
  esac
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
cleanup_lock() {
  if test -f "$LOCK_DIR/owner" && test ! -L "$LOCK_DIR/owner" && test -s "$LOCK_DIR/owner"; then
    IFS= read -r current_owner < "$LOCK_DIR/owner" || return 0
    case "$current_owner" in
      ''|*[!A-Za-z0-9_.:-]*) return 0 ;;
    esac
    if test "$current_owner" = "$LOCK_OWNER"; then
      rm -rf -- "$LOCK_DIR"
    fi
  fi
}
trap cleanup_lock EXIT
OWNER_TMP="${LOCK_DIR}.owner-${LOCK_OWNER}"
test ! -e "$OWNER_TMP"
test ! -L "$OWNER_TMP"
printf '%s\n%s\n%s\nlease_seconds=%s\n' "$LOCK_OWNER" "$(date +%s)" "$(hostname)" "$LOCK_LEASE_SECONDS" > "$OWNER_TMP"
mv -T -- "$OWNER_TMP" "$LOCK_DIR/owner"
test -s "$LOCK_DIR/owner"
test ! -L "$LOCK_DIR/owner"
IFS= read -r COMMITTED_OWNER < "$LOCK_DIR/owner"
case "$COMMITTED_OWNER" in
  ''|*[!A-Za-z0-9_.:-]*) exit 1 ;;
esac
test "$COMMITTED_OWNER" = "$LOCK_OWNER"

SOURCE="${DEPLOY_PATH}.backup-<timestamp>-<run>-<attempt>"
BACKUP_SOURCE="$SOURCE"
# 若要直接使用保留的发布目录，把 SOURCE 设为它的 release-* 路径，
# 并把 BACKUP_SOURCE 设为空字符串。

test -d "$RELEASE_ROOT"
test ! -L "$RELEASE_ROOT"
RELEASE_ROOT_REAL="$(readlink -f -- "$RELEASE_ROOT")"
test -n "$RELEASE_ROOT_REAL"
test "$RELEASE_ROOT_REAL" != "/"
test -L "$DEPLOY_PATH"
EXPECTED_CURRENT_TARGET="$(readlink -f -- "$DEPLOY_PATH")"
test -n "$EXPECTED_CURRENT_TARGET"
test -d "$EXPECTED_CURRENT_TARGET"
test "$EXPECTED_CURRENT_TARGET" != "$RELEASE_ROOT_REAL"
case "$EXPECTED_CURRENT_TARGET/" in
  "$RELEASE_ROOT_REAL"/*) ;;
  *)
    printf '%s\n' "refusing external current DEPLOY_PATH target: $EXPECTED_CURRENT_TARGET" >&2
    exit 1
    ;;
esac

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
test -f "$temporary_link/index.html"
test ! -L "$temporary_link/index.html"
test -L "$DEPLOY_PATH"
CURRENT_TARGET="$(readlink -f -- "$DEPLOY_PATH")"
test -n "$CURRENT_TARGET"
test -d "$CURRENT_TARGET"
test "$CURRENT_TARGET" = "$EXPECTED_CURRENT_TARGET"
test "$CURRENT_TARGET" != "$RELEASE_ROOT_REAL"
case "$CURRENT_TARGET/" in
  "$RELEASE_ROOT_REAL"/*) ;;
  *)
    printf '%s\n' "refusing changed DEPLOY_PATH target: $CURRENT_TARGET" >&2
    exit 1
    ;;
esac
mv -Tf -- "$temporary_link" "$DEPLOY_PATH"
```

回滚后请检查主要 HTTPS 路由。不要删除无关的服务器文件或 Web 服务器配置。
