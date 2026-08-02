const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("コピーしました");
  } catch {
    showToast("コピーできませんでした");
  }
}

function bindCopyButtons(scope = document) {
  scope.querySelectorAll("[data-copy], [data-copy-target]").forEach((button) => {
    if (button.dataset.bound === "true") {
      return;
    }
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      if (button.dataset.copy) {
        copyText(button.dataset.copy);
        return;
      }
      const target = document.getElementById(button.dataset.copyTarget);
      if (target) {
        copyText(target.textContent);
      }
    });
  });
}

async function loadSourceBlocks() {
  const blocks = Array.from(document.querySelectorAll("pre[data-src]"));
  await Promise.all(
    blocks.map(async (block) => {
      try {
        const response = await fetch(block.dataset.src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, "text/html");
        const source = doc.querySelector("pre");
        block.textContent = source ? source.textContent : "読み込み失敗";
      } catch {
        block.textContent = "読み込み失敗";
      }
    })
  );
}

const items = window.PS_ITEMS || [];
const modules = window.PS_MODULES || {};
let currentModule = "";
let currentQuery = "";
let selectedId = "";

function currentRecordFileName(id) {
  const digits = (id.match(/(\d{4})$/) || [null, "0001"])[1];
  return `PS51-WS2022-2026-${digits}.txt`;
}

function filteredItems() {
  const query = currentQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (currentModule && item.module !== currentModule) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${item.title} ${item.module}`.toLowerCase().includes(query);
  });
}

function renderModules() {
  const container = document.getElementById("record-modules");
  const moduleButtons = [
    `<button class="module ${currentModule === "" ? "active" : ""}" data-module="">すべて <b>${items.length}</b></button>`,
    ...Object.entries(modules).map(
      ([name, count]) =>
        `<button class="module ${currentModule === name ? "active" : ""}" data-module="${name}">${name} <b>${count}</b></button>`
    ),
  ];
  container.innerHTML = moduleButtons.join("");
  container.querySelectorAll(".module").forEach((button) => {
    button.addEventListener("click", () => {
      currentModule = button.dataset.module;
      renderRecordList();
    });
  });
}

function renderRecordList() {
  const currentItems = filteredItems();
  document.getElementById("record-list-label").textContent = currentModule || "すべての record";
  document.getElementById("record-list-count").textContent = currentItems.length;
  const container = document.getElementById("record-items");
  container.innerHTML = currentItems
    .map(
      (item) =>
        `<button class="record-item ${item.id === selectedId ? "current" : ""}" data-id="${item.id}"><strong>${item.title}</strong><small>${item.module}</small></button>`
    )
    .join("");
  container.querySelectorAll(".record-item").forEach((button) => {
    button.addEventListener("click", () => openRecord(button.dataset.id));
  });
  renderModules();
}

async function openRecord(id) {
  selectedId = id;
  renderRecordList();

  const title = document.getElementById("record-title");
  const meta = document.getElementById("record-meta");
  const fileName = document.getElementById("record-file-name");
  const source = document.getElementById("record-source");
  const item = items.find((entry) => entry.id === id);

  title.textContent = item ? item.title : id;
  meta.textContent = item ? `${item.module} / ${item.sourceUrlEn}` : "";
  fileName.textContent = currentRecordFileName(id);
  source.textContent = "読み込み中...";

  try {
    const response = await fetch(`records/${id}.html`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const pre = doc.querySelector("pre");
    source.textContent = pre ? pre.textContent : "record を読み込めませんでした。";
  } catch {
    source.textContent = "record を読み込めませんでした。";
  }
}

document.getElementById("record-search").addEventListener("input", (event) => {
  currentQuery = event.target.value;
  renderRecordList();
});

bindCopyButtons();
loadSourceBlocks();
renderRecordList();
if (items.length) {
  openRecord(items[0].id);
}
