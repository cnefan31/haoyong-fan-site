---
title: "How to Add Blog Posts"
date: "2026-05-22"
tags: ["guide", "tutorial"]
summary: "Step-by-step guide to adding new blog posts to haoyong.fan using Markdown."
---

This site is built with a simple static site generator. Adding a new blog post takes just a few steps.

## Prerequisites

You'll need SSH access to the server at `149.88.88.16` on port `19048`.

## Step 1: Connect to the Server

```bash
ssh -p 19048 root@149.88.88.16
```

## Step 2: Create Your Markdown File

Navigate to the posts directory:

```bash
cd /opt/haoyong-fan-site/src/content/posts/
```

Create a new file with the `.md` extension. For example:

```bash
nano my-new-post.md
```

## Step 3: Write the Front Matter

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

## Step 4: Write Your Content

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

## Step 5: Build and Deploy

From the project root:

```bash
cd /opt/haoyong-fan-site
npm run build
```

This will automatically:
1. Convert your Markdown to HTML
2. Generate the blog list page
3. Create individual post pages
4. Generate tag pages for each tag
5. Copy everything to the website directory

## Step 6: Verify

Open `https://haoyong.fan/blog/` to see your new post in the list.

## Tips

- Keep `tags` simple — lowercase, no spaces, use hyphens if needed
- The `summary` field is shown on the blog list page, write a good one
- Code blocks work great with language hints: ````go` or ````python`
- Posts are sorted by date, newest first

## File Structure

```
/opt/haoyong-fan-site/
├── src/
│   └── content/
│       └── posts/          ← Your .md files go here
│           ├── welcome.md
│           ├── cloud-native-tips.md
│           └── my-new-post.md
├── build.js                ← The build script
└── dist/                   ← Generated HTML (don't edit)
```
