const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const hljs = require('highlight.js');

// Configure marked with highlight.js
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

const BASE_DIR = __dirname;
const SRC_DIR = path.join(BASE_DIR, 'src');
const DIST_DIR = path.join(BASE_DIR, 'dist');
// Server deployment path — update this if deploying elsewhere
const WEBROOT_DIR = '/opt/app/haoyong.fan';

// Validate URL is safe (only http/https allowed, no javascript: etc)
const safeUrl = (url) => {
  if (!url || typeof url !== 'string') return '#';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('mailto:')) return url;
  return '#';
};

// Escape HTML entities for user content
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

try {
  // Ensure dist directory
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'blog'), { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'blog/tag'), { recursive: true });

  // Copy static assets
  const copyDir = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  };

  copyDir(path.join(SRC_DIR, 'css'), DIST_DIR);
  copyDir(path.join(SRC_DIR, 'js'), DIST_DIR);
  if (fs.existsSync(path.join(SRC_DIR, 'assets'))) {
    copyDir(path.join(SRC_DIR, 'assets'), DIST_DIR);
  }

  // Load content data
  const aboutData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'content', 'about.json'), 'utf8'));
  const experienceData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'content', 'experience.json'), 'utf8'));
  const projectsData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'content', 'projects.json'), 'utf8'));

  // Load and parse blog posts
  const postsDir = path.join(SRC_DIR, 'content', 'posts');
  const posts = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = fs.readFileSync(path.join(postsDir, file), 'utf8');
      const { data, content } = matter(raw);
      const slug = file.replace('.md', '');
      const html = marked(content);
      return { ...data, slug, html, content };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Collect all tags
  const allTags = [...new Set(posts.flatMap(p => p.tags || []))];

  // Read templates
  const layoutTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'layout.html'), 'utf8');
  const aboutTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'about.html'), 'utf8');
  const experienceTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'experience.html'), 'utf8');
  const projectsTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'projects.html'), 'utf8');
  const blogListTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'blog-list.html'), 'utf8');
  const blogPostTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'blog-post.html'), 'utf8');
  const blogTagTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates', 'blog-tag.html'), 'utf8');

  // Helper: wrap content in layout
  const wrapInLayout = (content, pageTitle, activeNav) => {
    return layoutTemplate
      .replace(/\{\{page-title\}\}/g, pageTitle)
      .replace(/\{\{active-nav\}\}/g, activeNav)
      .replace(/\{\{content\}\}/g, content);
  };

  // Helper: render skills
  const renderSkills = (skills) =>
    (skills || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');

  // Helper: render experience cards
  const renderExperience = (entries) =>
    (entries || []).map(e => `
    <div class="exp-card">
      <div class="exp-title">${escapeHtml(e.title)}</div>
      <div class="exp-company">${escapeHtml(e.company)} · ${escapeHtml(e.period)}</div>
      <div class="exp-desc">${escapeHtml(e.description)}</div>
    </div>
  `).join('');

  // Helper: render project cards
  const renderProjects = (entries) =>
    (entries || []).map(p => `
    <div class="project-card">
      <div class="project-name">${escapeHtml(p.name)}</div>
      <div class="project-desc">${escapeHtml(p.description)}</div>
      <div class="project-tags">${(p.tech || []).map(t => `<span class="skill-tag">${escapeHtml(t)}</span>`).join('')}</div>
      ${p.link ? `<a href="${safeUrl(p.link)}" class="project-link" target="_blank" rel="noopener noreferrer">View →</a>` : ''}
    </div>
  `).join('');

  // Helper: render blog list items
  const renderBlogList = (posts) =>
    posts.map(p => `
    <div class="blog-item">
      <a href="/blog/${p.slug}.html" class="blog-title">${escapeHtml(p.title)}</a>
      <div class="blog-meta">${escapeHtml(p.date)} · ${(p.tags || []).map(t => `<a href="/blog/tag/${t}.html" class="blog-tag">${escapeHtml(t)}</a>`).join('')}</div>
      <div class="blog-summary">${escapeHtml(p.summary || '')}</div>
    </div>
  `).join('');

  // Generate About page
  const aboutContent = aboutTemplate
    .replace(/\{\{name\}\}/g, escapeHtml(aboutData.name))
    .replace(/\{\{avatar\}\}/g, aboutData.avatar || '')
    .replace(/\{\{bio\}\}/g, escapeHtml(aboutData.bio))
    .replace(/\{\{skills\}\}/g, renderSkills(aboutData.skills))
    .replace(/\{\{contacts\}\}/g, Object.entries(aboutData.contacts || {}).map(([k, v]) =>
      `<a href="${safeUrl(v)}" class="contact-link" target="_blank" rel="noopener noreferrer">${escapeHtml(k)}</a>`
    ).join(''));
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), wrapInLayout(aboutContent, escapeHtml(aboutData.name), 'about'));

  // Generate Experience page
  const expContent = experienceTemplate.replace(/\{\{entries\}\}/g, renderExperience(experienceData));
  fs.writeFileSync(path.join(DIST_DIR, 'experience.html'), wrapInLayout(expContent, 'Experience', 'experience'));

  // Generate Projects page
  const projContent = projectsTemplate.replace(/\{\{entries\}\}/g, renderProjects(projectsData));
  fs.writeFileSync(path.join(DIST_DIR, 'projects.html'), wrapInLayout(projContent, 'Projects', 'projects'));

  // Generate Blog list page
  const blogListContent = blogListTemplate
    .replace(/\{\{posts\}\}/g, renderBlogList(posts))
    .replace(/\{\{all-tags\}\}/g, allTags.map(t => `<a href="/blog/tag/${t}.html" class="tag-filter">${escapeHtml(t)}</a>`).join(''));
  fs.writeFileSync(path.join(DIST_DIR, 'blog.html'), wrapInLayout(blogListContent, 'Blog', 'blog'));

  // Generate individual blog posts
  posts.forEach(post => {
    const postContent = blogPostTemplate
      .replace(/\{\{title\}\}/g, escapeHtml(post.title))
      .replace(/\{\{date\}\}/g, escapeHtml(post.date))
      .replace(/\{\{tags\}\}/g, (post.tags || []).map(t => `<a href="/blog/tag/${t}.html" class="blog-tag">${escapeHtml(t)}</a>`).join(''))
      .replace(/\{\{content\}\}/g, post.html);
    fs.writeFileSync(path.join(DIST_DIR, 'blog', `${post.slug}.html`), wrapInLayout(postContent, escapeHtml(post.title), 'blog'));
  });

  // Generate tag pages
  allTags.forEach(tag => {
    const taggedPosts = posts.filter(p => (p.tags || []).includes(tag));
    const tagContent = blogTagTemplate
      .replace(/\{\{tag\}\}/g, escapeHtml(tag))
      .replace(/\{\{posts\}\}/g, renderBlogList(taggedPosts));
    fs.writeFileSync(path.join(DIST_DIR, 'blog/tag', `${tag}.html`), wrapInLayout(tagContent, `#${escapeHtml(tag)}`, 'blog'));
  });

  // Copy to webroot (non-destructive: only copies files that exist in dist)
  try {
    fs.rmSync(WEBROOT_DIR, { recursive: true, force: true });
    copyDir(DIST_DIR, WEBROOT_DIR);
    console.log(`Deployed to ${WEBROOT_DIR}`);
  } catch (deployErr) {
    console.warn(`Warning: Could not deploy to ${WEBROOT_DIR} (${deployErr.code}). Build output still available at ${DIST_DIR}.`);
  }

  console.log('Build complete!');
  console.log(`Pages: index, experience, projects, blog + ${posts.length} posts + ${allTags.length} tag pages`);

} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
