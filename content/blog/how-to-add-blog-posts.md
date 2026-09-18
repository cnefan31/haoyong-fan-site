---
title: "如何添加一篇博客文章"
slug: "how-to-add-blog-posts"
date: 2026-05-22
description: "使用 Markdown 为 haoyong.fan 添加新文章的分步指南。"
summary: "使用 Markdown 为 haoyong.fan 添加新文章的分步指南。"
tags:
  - guide
  - tutorial
draft: false
---

本站使用静态站点生成器构建。添加一篇新文章只需要几步。

## 前置条件

你需要本地安装 Hugo、拥有仓库访问权限，并且有推送到 `main` 分支的权限。

## 第 1 步：创建 Markdown 文件

在本地仓库中，进入博客内容目录：

```bash
cd content/blog/
```

新建一个 `.md` 文件，例如：

```bash
nano my-new-post.md
```

## 第 2 步：编写 Front Matter

每篇文章都以 YAML front matter 开头：

```markdown
---
title: "文章标题"
date: "2026-05-22"
tags: ["标签1", "标签2"]
summary: "文章的简要描述。"
---

正文内容写在这里……
```

**Front matter 字段：**
- `title` — 文章标题（必填）
- `date` — 发布日期，格式为 `YYYY-MM-DD`（必填）
- `tags` — 主题标签数组（可选）
- `summary` — 在列表中显示的简短描述（可选）

## 第 3 步：编写正文

在 front matter 下方，用 Markdown 编写文章：

```markdown
## 引言

在这里写引言。

## 正文

用 **Markdown** 编写你的内容。

## 结语

用一个结语收尾。
```

本站支持：
- **粗体**和*斜体*
- `行内代码`以及带语法高亮的代码块
- 有序和无序列表
- 引用块
- 链接和图片

## 第 4 步：本地预览

在仓库目录下启动 Hugo 本地开发服务器：

```bash
hugo server
```

打开 Hugo 输出的本地地址，检查文章、排版、代码块和标签。

## 第 5 步：推送并部署

提交 Markdown 文件并推送到 `main`：

```bash
git add my-new-post.md
git commit -m "docs: add blog post"
git push origin main
```

在 `.github/workflows/deploy.yml` 与仓库的 GitHub Actions Secrets 配置完成后，推送到 `main` 会触发 GitHub Actions 使用 Hugo 构建站点，并通过 SSH 部署生成的文件。仓库需要配置以下 GitHub Actions Secrets：

- `DEPLOY_HOST` — 部署服务器主机名
- `DEPLOY_PORT` — 部署服务器的 SSH 端口号
- `DEPLOY_USER` — 专用的非 root 部署用户
- `DEPLOY_SSH_KEY` — 该部署用户的私钥
- `DEPLOY_KNOWN_HOSTS` — 已验证的部署服务器主机密钥
- `DEPLOY_PATH` — 站点的服务器文档根目录

部署用户的权限应限制在站点目录内。不要使用 root SSH 登录，不要把密钥值提交到仓库，也不要在日志中打印密钥。

## 第 6 步：验证已发布的文章

打开 `https://haoyong.fan/blog/`，在列表中查看你的新文章。

## 小贴士

- `tags` 尽量简单 —— 使用小写、不带空格，必要时用连字符
- `summary` 会显示在博客列表中，值得认真写
- 代码块支持语言标注，例如 ````go` 或 ````python`
- 文章按日期排序，最新的在前

## 仓库结构

```
repository/
├── content/
│   └── blog/               ← 你的 .md 文件放在这里
│       ├── welcome.md
│       ├── cloud-native-tips.md
│       └── my-new-post.md
└── hugo.toml               ← 站点配置
```
