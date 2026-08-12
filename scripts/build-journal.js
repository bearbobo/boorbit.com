const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "journal");
const POSTS_DIR = path.join(ROOT, "posts");
const TEMPLATE_FILE = path.join(ROOT, "templates", "journal.html");

const categoryPages = {
  "工作经验": "work.html",
  "生活感悟": "life.html",
  "新技术雷达": "radar.html"
};

const categoryLinks = {
  "工作经验": "../work.html",
  "生活感悟": "../life.html",
  "新技术雷达": "../radar.html"
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function replaceToken(template, token, value) {
  return template.split(`{{${token}}}`).join(value);
}

function buildTags(tags) {
  if (!Array.isArray(tags)) return "";

  return tags
    .map((tag, index) => {
      const classes = [
        "tag-green",
        "tag-orange",
        "tag-gray"
      ];

      const tagClass = classes[index % classes.length];

      return `<span class="tag ${tagClass}">${escapeHtml(tag)}</span>`;
    })
    .join("\n      ");
}

function normalizeDate(date) {
  if (!date) return "";

  if (date instanceof Date && !Number.isNaN(date.valueOf())) {
    return date.toISOString().slice(0, 10);
  }

  return String(date).slice(0, 10);
}

function buildPrevNext(post, categoryPosts) {
  const index = categoryPosts.findIndex(
    (item) => item.slug === post.slug
  );

  if (index === -1) return "";

  // categoryPosts 按日期从新到旧排列
  const newerPost =
    index > 0 ? categoryPosts[index - 1] : null;

  const olderPost =
    index < categoryPosts.length - 1
      ? categoryPosts[index + 1]
      : null;

  const links = [];

  if (newerPost) {
    links.push(`
      <a href="${escapeHtml(newerPost.slug)}.html">
        ← <span class="lbl">上一篇 · ${escapeHtml(post.category)}</span>
        ${escapeHtml(newerPost.icon)} ${escapeHtml(newerPost.title)}
      </a>`);
  }

  if (olderPost) {
    links.push(`
      <a href="${escapeHtml(olderPost.slug)}.html">
        <span class="lbl">下一篇 · ${escapeHtml(post.category)}</span>
        ${escapeHtml(olderPost.icon)} ${escapeHtml(olderPost.title)} →
      </a>`);
  }

  if (links.length === 0) return "";

  return `
    <div class="prevnext">
      ${links.join("\n")}
    </div>`;
}

function updateCategoryPage(posts, categoryName, pageFile) {
  const targetFile = path.join(ROOT, pageFile);

  if (!fs.existsSync(targetFile)) {
    console.warn(`⚠️ ${pageFile} not found. Skipping.`);
    return;
  }

  const categoryPosts = posts
    .filter((post) => post.category === categoryName)
    .sort((a, b) => b.date.localeCompare(a.date));

  const generatedHtml = categoryPosts
    .map((post, index) => {
      const isLast = index === categoryPosts.length - 1;
      const borderStyle = isLast
        ? ' style="border-bottom:none;"'
        : "";

      return `
      <a class="post-row" href="posts/${escapeHtml(post.slug)}.html"${borderStyle}>
        <span class="em">${escapeHtml(post.icon)}</span>
        <div class="txt">
          <div class="t">${escapeHtml(post.title)}</div>
          <div class="s">${escapeHtml(post.summary)}</div>
        </div>
        <span class="date">${escapeHtml(post.date)}</span>
      </a>`;
    })
    .join("\n");

  const original = fs.readFileSync(targetFile, "utf8");

  const startMarker = "<!-- JOURNAL_AUTO_START -->";
  const endMarker = "<!-- JOURNAL_AUTO_END -->";

  const startIndex = original.indexOf(startMarker);
  const endIndex = original.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.warn(`⚠️ Journal markers not found in ${pageFile}.`);
    return;
  }

  const before =
    original.slice(0, startIndex + startMarker.length);

  const after =
    original.slice(endIndex);

  const updated =
    before +
    "\n" +
    generatedHtml +
    "\n      " +
    after;

  fs.writeFileSync(targetFile, updated, "utf8");

  console.log(
    `✅ Updated ${pageFile} with ${categoryPosts.length} CMS Journal post(s)`
  );
}

function buildJournal() {
  console.log("🛰️ BoOrbit Journal Builder");
  console.log("--------------------------");

  if (!fs.existsSync(CONTENT_DIR)) {
    console.log("No Journal content directory found.");
    return;
  }

  if (!fs.existsSync(TEMPLATE_FILE)) {
    throw new Error("templates/journal.html not found.");
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    console.log("No Journal Markdown files found.");
    return;
  }

  let draftCount = 0;

  const publishedPosts = [];

  // 第一步：先读取所有已发布文章
  for (const file of files) {
    const sourcePath = path.join(CONTENT_DIR, file);
    const source = fs.readFileSync(sourcePath, "utf8");

    const { data, content } = matter(source);

    if (data.published !== true) {
      console.log(`⏭️ Draft skipped: ${file}`);
      draftCount++;
      continue;
    }

    const slug =
      String(data.slug || path.basename(file, ".md"))
        .trim()
        .replace(/[^a-zA-Z0-9-_]/g, "-");

    if (!slug) {
      console.warn(`⚠️ Invalid slug: ${file}`);
      continue;
    }

    publishedPosts.push({
      slug,
      title: data.title || "Untitled",
      icon: data.icon || "📝",
      category: data.category || "Journal",
      summary: data.summary || "",
      date: normalizeDate(data.date),
      readTime: data.read_time || "",
      tags: data.tags || [],
      content
    });
  }

  // 第二步：按分类预先排序
  const postsByCategory = {};

  for (const categoryName of Object.keys(categoryPages)) {
    postsByCategory[categoryName] = publishedPosts
      .filter((post) => post.category === categoryName)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // 第三步：生成文章页面
  let publishedCount = 0;

  for (const post of publishedPosts) {
    const title = escapeHtml(post.title);
    const icon = escapeHtml(post.icon);
    const category = escapeHtml(post.category);
    const categoryLink =
      categoryLinks[post.category] || "../index.html";

    const date = escapeHtml(post.date);
    const readTime = escapeHtml(post.readTime);
    const tags = buildTags(post.tags);

    const bodyHtml = marked.parse(post.content);

    const categoryPosts =
      postsByCategory[post.category] || [];

    const prevnext =
      buildPrevNext(post, categoryPosts);

    let output = template;

    output = replaceToken(output, "title", title);
    output = replaceToken(output, "icon", icon);
    output = replaceToken(output, "category", category);
    output = replaceToken(output, "category_link", categoryLink);
    output = replaceToken(output, "date", date);
    output = replaceToken(output, "read_time", readTime);
    output = replaceToken(output, "tags", tags);
    output = replaceToken(output, "content", bodyHtml);
    output = replaceToken(output, "prevnext", prevnext);

    const outputFile = path.join(
      POSTS_DIR,
      `${post.slug}.html`
    );

    fs.writeFileSync(outputFile, output, "utf8");

    console.log(`✅ Published: posts/${post.slug}.html`);
    publishedCount++;
  }

  // 第四步：更新分类列表
  for (const [categoryName, pageFile] of Object.entries(categoryPages)) {
    updateCategoryPage(
      publishedPosts,
      categoryName,
      pageFile
    );
  }

  console.log("--------------------------");
  console.log(`Published: ${publishedCount}`);
  console.log(`Drafts skipped: ${draftCount}`);
  console.log("✨ Journal build finished.");
}

buildJournal();
