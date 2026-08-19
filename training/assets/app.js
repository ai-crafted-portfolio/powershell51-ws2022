(() => {
  const manifestUrl = "data/manifest.json";
  const text = (node, value) => { node.textContent = value; return node; };
  async function getManifest() { const response = await fetch(manifestUrl); if (!response.ok) throw new Error("研修資料の一覧を読み込めませんでした。"); return response.json(); }
  async function copyToClipboard(value, statusNode) {
    try { await navigator.clipboard.writeText(value); } catch {
      const area = document.createElement("textarea"); area.value = value; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
    }
    if (statusNode) text(statusNode, "コピーしました。PowerPoint などで貼り付けてください。");
  }
  function showError(target, message) { const box = document.createElement("div"); box.className = "error-box"; text(box, message); target.replaceChildren(box); }
  function categoriesOf(items) { return [...new Set(items.map((item) => item.category))]; }
  async function renderHome() {
    const list = document.querySelector("#lesson-list"), tabs = document.querySelector("#category-tabs"), count = document.querySelector("#lesson-count"), search = document.querySelector("#lesson-search");
    let selectedCategory = "すべて", keyword = "";
    try {
      const items = await getManifest();
      const render = () => {
        const shown = items.filter((item) => (selectedCategory === "すべて" || item.category === selectedCategory) && `${item.number} ${item.title} ${item.category}`.toLowerCase().includes(keyword));
        text(count, `${shown.length} 件を表示しています`);
        list.replaceChildren(...shown.map((item) => {
          const link = document.createElement("a"); link.className = "lesson-card"; link.href = `lesson.html?id=${encodeURIComponent(item.id)}`;
          const number = text(document.createElement("span"), `No.${String(item.number).padStart(2, "0")}`); number.className = "number";
          const title = text(document.createElement("h3"), item.title);
          const meta = document.createElement("p"); meta.className = "meta"; const category = text(document.createElement("span"), item.category); category.className = "category"; meta.append(category, document.createTextNode(` ｜ ${item.slides} スライド`)); link.append(number, title, meta); return link;
        }));
      };
      const addTab = (label) => { const button = text(document.createElement("button"), label); button.type = "button"; button.className = "category-tab"; button.setAttribute("aria-pressed", String(label === selectedCategory)); button.addEventListener("click", () => { selectedCategory = label; [...tabs.children].forEach((tab) => tab.setAttribute("aria-pressed", String(tab.textContent === label))); render(); }); tabs.append(button); };
      ["すべて", ...categoriesOf(items)].forEach(addTab); search.addEventListener("input", () => { keyword = search.value.trim().toLowerCase(); render(); }); render();
    } catch (error) { showError(list, error.message); }
  }
  function splitSlides(markdown) {
    const matches = [...markdown.matchAll(/^###\s+(.+)$/gm)]; if (!matches.length) return [{ heading: "研修資料", copyText: markdown }];
    const intro = markdown.slice(0, matches[0].index).trim();
    return matches.map((match, index) => { const start = match.index, end = index + 1 < matches.length ? matches[index + 1].index : markdown.length; return { heading: match[1].trim(), copyText: `${index === 0 && intro ? `${intro}\n\n` : ""}${markdown.slice(start, end).trim()}` }; });
  }
  async function renderLesson() {
    const hero = document.querySelector("#lesson-hero"), slidesTarget = document.querySelector("#slides"), slideNav = document.querySelector("#slide-nav"), rawSource = document.querySelector("#raw-source"), copyAll = document.querySelector("#copy-all"), status = document.querySelector("#copy-status"), id = new URLSearchParams(window.location.search).get("id");
    try {
      const items = await getManifest(), item = items.find((candidate) => candidate.id === id); if (!item) throw new Error("指定された研修資料は見つかりませんでした。一覧から選び直してください。");
      const response = await fetch(item.path); if (!response.ok) throw new Error("研修資料を読み込めませんでした。"); const markdown = (await response.text()).replace(/\r\n/g, "\n"), slides = splitSlides(markdown);
      document.title = `No.${String(item.number).padStart(2, "0")} ${item.title} | Windows 研修資料`; rawSource.href = item.path;
      const number = text(document.createElement("p"), `No.${String(item.number).padStart(2, "0")}｜${item.category}`); number.className = "lesson-number"; const title = text(document.createElement("h1"), item.title); const meta = text(document.createElement("p"), `${item.slides} スライド｜元PowerPointのレイアウトをそのまま表示`); meta.className = "lesson-meta"; hero.append(number, title, meta);
      copyAll.addEventListener("click", () => copyToClipboard(markdown, status));
      for (let index = 0; index < item.slides; index += 1) {
        const slide = slides[index] ?? { copyText: markdown }; const anchor = document.createElement("a"); anchor.href = `#slide-${index + 1}`; text(anchor, String(index + 1)); slideNav.append(anchor);
        const card = document.createElement("article"); card.className = "slide-card slide-image-card"; card.id = `slide-${index + 1}`;
        const top = document.createElement("div"); top.className = "slide-topline"; const indexLabel = text(document.createElement("span"), `スライド ${index + 1} / ${item.slides}`); indexLabel.className = "slide-index"; const button = text(document.createElement("button"), "このスライドの原稿をコピー"); button.type = "button"; button.className = "button slide-copy"; button.addEventListener("click", () => copyToClipboard(slide.copyText, status)); top.append(indexLabel, button);
        const image = document.createElement("img"); image.className = "slide-image"; image.src = `assets/slides/${item.id}/slide-${index + 1}.png`; image.alt = `No.${String(item.number).padStart(2, "0")} ${item.title}：スライド ${index + 1}`; image.decoding = "async"; image.loading = "eager"; card.append(top, image); slidesTarget.append(card);
      }
    } catch (error) { showError(hero, error.message); copyAll.disabled = true; rawSource.hidden = true; }
  }
  if (document.body.dataset.page === "home") renderHome(); if (document.body.dataset.page === "lesson") renderLesson();
})();
