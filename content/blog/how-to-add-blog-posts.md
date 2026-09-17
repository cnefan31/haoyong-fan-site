---
title: "How to Add Blog Posts"
date: 2026-05-22
description: "Step-by-step guide to adding new blog posts to haoyong.fan using Markdown."
summary: "Step-by-step guide to adding new blog posts to haoyong.fan using Markdown."
tags:
  - guide
  - tutorial
draft: false
---

This site is built with a simple static site generator. Adding a new blog post takes just a few steps.

## Prerequisites

You'll need a local Hugo installation, access to the repository, and permission to push to `main`.

## Step 1: Create Your Markdown File

From a local checkout of the repository, navigate to the blog content directory:

```bash
cd content/blog/
```

Create a new file with the `.md` extension. For example:

```bash
nano my-new-post.md
```

## Step 2: Write the Front Matter

Every post starts with YAML front matter:

```markdown
---
title: "Your Post Title"
date: "2026-05-22"
tags: ["tag1", "tag2"]
summary: "A brief description of your post."
---

Your content goes here...
```

**Front matter fields:**
- `title` — The post title (required)
- `date` — Publication date in `YYYY-MM-DD` format (required)
- `tags` — Array of topic tags (optional)
- `summary` — Short description shown in the blog list (optional)

## Step 3: Write Your Content

Below the front matter, write your post in Markdown:

```markdown
## Introduction

Write your introduction here.

## Main Section

Your content in **Markdown** format.

## Conclusion

Wrap up with a conclusion.
```

The site supports:
- **Bold** and *italic* text
- `inline code` and fenced code blocks with syntax highlighting
- Ordered and unordered lists
- Blockquotes
- Links and images

## Step 4: Preview Locally

From the repository directory, start Hugo's local development server:

```bash
hugo server
```

Open the local URL printed by Hugo to check the post, formatting, code blocks, and tags.

## Step 5: Push and Deploy

Commit the Markdown file and push it to `main`:

```bash
git add content/blog/my-new-post.md
git commit -m "docs: add blog post"
git push origin main
```

Once `.github/workflows/deploy.yml` and the repository's GitHub Actions Secrets are configured, pushing to `main` triggers GitHub Actions to build the site with Hugo and deploy the generated files over SSH. The repository must have these GitHub Actions Secrets configured:

- `DEPLOY_HOST` — the deployment server hostname
- `DEPLOY_USER` — a dedicated non-root deployment user
- `DEPLOY_SSH_KEY` — the private key for that deployment user
- `DEPLOY_PATH` — the server document root for the site

The deployment user should have access limited to the site directory. Do not use root SSH access, commit secret values, or print secrets in logs.

## Step 6: Verify the Published Post

Open `https://haoyong.fan/blog/` to see your new post in the list.

## Tips

- Keep `tags` simple — lowercase, no spaces, use hyphens if needed
- The `summary` field is shown on the blog list page, write a good one
- Code blocks work great with language hints: ````go` or ````python`
- Posts are sorted by date, newest first

## Repository Structure

```
repository/
├── content/
│   └── blog/               ← Your .md files go here
│       ├── welcome.md
│       ├── cloud-native-tips.md
│       └── my-new-post.md
└── hugo.toml               ← Site configuration
```
