const $ = (id) => document.getElementById(id);

let moduleName = "";
let query = "";
let selected = "";

const items = window.PS_ITEMS;
const modules = window.PS_MODULES;
const reader = $("reader");

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

function sourceSlug(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

function buildArticleLinkMap() {
  const map = new Map();

  for (const item of items) {
    const title = String(item.title || "").trim();
    const keys = new Set();

    if (title) {
      keys.add(`${title.toLowerCase()}.md`);
      keys.add(`${title.replace(/\s+/g, "_").toLowerCase()}.md`);
      keys.add(`${title.replace(/\s+/g, "-").toLowerCase()}.md`);
    }

    const slug = sourceSlug(item.sourceUrlEn);
    if (slug) {
      keys.add(`${slug.toLowerCase()}.md`);
    }

    for (const key of keys) {
      if (!map.has(key)) {
        map.set(key, item.id);
      }
    }
  }

  return map;
}

const articleLinkMap = buildArticleLinkMap();

function visibleItems() {
  const lowered = query.toLowerCase();
  return items.filter((item) => {
    if (moduleName && item.module !== moduleName) {
      return false;
    }

    if (!lowered) {
      return true;
    }

    return `${item.title} ${item.module}`.toLowerCase().includes(lowered);
  });
}

function renderModules() {
  const modulesElement = $("modules");
  modulesElement.innerHTML = Object.entries(modules)
    .map(([name, count]) =>
      `<button class="module ${name === moduleName ? "active" : ""}" data-module="${escapeHtml(name)}">${escapeHtml(name)} <b>${count}</b></button>`
    )
    .join("");

  document.querySelectorAll(".module").forEach((button) => {
    button.onclick = () => {
      moduleName = button.dataset.module;
      render();
    };
  });
}

function render() {
  const currentItems = visibleItems();

  $("listlabel").textContent = moduleName || "すべての資料";
  $("listcount").textContent = currentItems.length;
  $("items").innerHTML = currentItems
    .map((item) =>
      `<button class="item ${item.id === selected ? "current" : ""}" data-id="${item.id}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.module)}</small></button>`
    )
    .join("");

  document.querySelectorAll(".item").forEach((button) => {
    button.onclick = () => openItem(button.dataset.id);
  });

  renderModules();
}

function normalizeArticleHref(href) {
  const clean = href.split("#")[0].split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return (parts.at(-1) || "").toLowerCase();
}

function wireArticleLinks(container) {
  container.querySelectorAll("a[href]").forEach((link) => {
    const normalized = normalizeArticleHref(link.getAttribute("href") || "");
    if (!normalized.endsWith(".md")) {
      return;
    }

    const targetId = articleLinkMap.get(normalized);
    if (!targetId) {
      link.title = "このサイト内では対応する資料を特定できません。";
      return;
    }

    link.href = "#";
    link.dataset.articleId = targetId;
    link.onclick = (event) => {
      event.preventDefault();
      openItem(targetId);
    };
  });
}

async function openItem(id) {
  selected = id;
  render();

  const item = items.find((entry) => entry.id === id);
  reader.innerHTML = '<div class="loading">公式資料を読み込んでいます...</div>';

  try {
    const response = await fetch(`articles/${id}.html`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const japaneseLink = item.sourceUrlJa
      ? `<a href="${item.sourceUrlJa}" target="_blank" rel="noreferrer">日本語公式資料を開く</a>`
      : "";

    reader.innerHTML =
      `<header class="articlehead"><p class="eyebrow">MICROSOFT LEARN / ${escapeHtml(item.module)}</p><h2>${escapeHtml(item.title)}</h2><p>${japaneseLink}<a href="${item.sourceUrlEn}" target="_blank" rel="noreferrer">英語原文を開く</a></p></header>` +
      `<div class="parallel"><section><h3>${escapeHtml(item.japaneseKind)}</h3>${doc.querySelector(".jp-official").innerHTML}</section><section><h3>英語原文（Microsoft Learn）</h3>${doc.querySelector(".en-original").innerHTML}</section></div>`;

    wireArticleLinks(reader);
    reader.scrollTop = 0;
  } catch (error) {
    reader.innerHTML = '<div class="empty">資料を読み込めませんでした。</div>';
  }
}

$("search").oninput = (event) => {
  query = event.target.value;
  render();
};

render();
if (items.length) {
  openItem(items[0].id);
}
