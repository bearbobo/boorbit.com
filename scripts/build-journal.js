const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "journal");
const POSTS_DIR = path.join(ROOT, "posts");
const TEMPLATE_FILE = path.join(ROOT, "templates", "journal.html");
const WORK_FILE = path.join(ROOT, "work.html");

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

// function updateWorkPage(posts) {
//   if (!fs.existsSync(WORK_FILE)) {
//     console.warn("⚠️ work.html not found. Skipping work page update.");
//     return;
//   }

//   const workPosts = posts
//     .filter((post) => post.category === "工作经验")
//     .sort((a, b) => b.date.localeCompare(a.date));

//   const generatedHtml = workPosts
//     .map((post, index) => {
//       const isLast = index === workPosts.length - 1;
//       const borderStyle = isLast ? ' style="border-bottom:none;"' : "";

//       return `
//       <a class="post-row" href="posts/${escapeHtml(post.slug)}.html"${borderStyle}>
//         <span class="em">${escapeHtml(post.icon)}</span>
//         <div class="txt">
//           <div class="t">${escapeHtml(post.title)}</div>
//           <div class="s">${escapeHtml(post.summary)}</div>
//         </div>
//         <span class="date">${escapeHtml(post.date)}</span>
//       </a>`;
//     })
//     .join("\n");

//   const original = fs.readFileSync(WORK_FILE, "utf8");

//   const startMarker = "<!-- JOURNAL_AUTO_START -->";
//   const endMarker = "<!-- JOURNAL_AUTO_END -->";

//   const startIndex = original.indexOf(startMarker);
//   const endIndex = original.indexOf(endMarker);

//   if (startIndex === -1 || endIndex === -1) {
//     console.warn("⚠️ Journal markers not found in work.html.");
//     return;
//   }

//   const before =
//     original.slice(0, startIndex + startMarker.length);

//   const after =
//     original.slice(endIndex);

//   const updated =
//     before +
//     "\n" +
//     generatedHtml +
//     "\n      " +
//     after;

//   fs.writeFileSync(WORK_FILE, updated, "utf8");

//   console.log(
//     `✅ Updated work.html with ${workPosts.length} CMS Journal post(s)`
//   );
// }
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

  let publishedCount = 0;
  let draftCount = 0;

  const publishedPosts = [];

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

    const rawDate = normalizeDate(data.date);

    const title = escapeHtml(data.title || "Untitled");
    const icon = escapeHtml(data.icon || "📝");
    const category = escapeHtml(data.category || "Journal");
    const categoryLink =
      categoryLinks[data.category] || "../index.html";

    const date = escapeHtml(rawDate);
    const readTime = escapeHtml(data.read_time || "");
    const tags = buildTags(data.tags);

    const bodyHtml = marked.parse(content);

    let output = template;

    output = replaceToken(output, "title", title);
    output = replaceToken(output, "icon", icon);
    output = replaceToken(output, "category", category);
    output = replaceToken(output, "category_link", categoryLink);
    output = replaceToken(output, "date", date);
    output = replaceToken(output, "read_time", readTime);
    output = replaceToken(output, "tags", tags);
    output = replaceToken(output, "content", bodyHtml);

    const outputFile = path.join(
      POSTS_DIR,
      `${slug}.html`
    );

    fs.writeFileSync(outputFile, output, "utf8");

    publishedPosts.push({
      slug,
      title: data.title || "Untitled",
      icon: data.icon || "📝",
      category: data.category || "Journal",
      summary: data.summary || "",
      date: rawDate
    });

    console.log(`✅ Published: posts/${slug}.html`);
    publishedCount++;
  }

  // updateWorkPage(publishedPosts);
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
