(() => {
  const manifestUrl = "data/manifest.json";
  const text = (node, value) => { node.textContent = value; return node; };

  async function getManifest() {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error("研修資料の一覧を読み込めませんでした。");
    return response.json();
  }

  async function copyToClipboard(value, statusNode) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (statusNode) text(statusNode, "コピーしました。PowerPoint などで貼り付けてください。");
  }

  function showError(target, message) {
    const box = document.createElement("div");
    box.className = "error-box";
    text(box, message);
    target.replaceChildren(box);
  }

  function productOf(item) {
    return item.category.startsWith("PowerShell 5.1｜") ? "PowerShell 5.1" : "Windows Server 2022 運用";
  }

  function majorOf(item) {
    return item.category.split("｜").at(-1);
  }

  function makeTab(label, active, onClick) {
    const button = text(document.createElement("button"), label);
    button.type = "button";
    button.className = "category-tab";
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", onClick);
    return button;
  }

  async function renderHome() {
    const list = document.querySelector("#lesson-list");
    const productTabs = document.querySelector("#product-tabs");
    const categoryTabs = document.querySelector("#category-tabs");
    const count = document.querySelector("#lesson-count");
    const search = document.querySelector("#lesson-search");
    let selectedProduct = "すべて";
    let selectedCategory = "すべて";
    let keyword = "";

    try {
      const items = await getManifest();
      const products = ["PowerShell 5.1", "Windows Server 2022 運用"];
      const visibleByProduct = () => selectedProduct === "すべて" ? items : items.filter((item) => productOf(item) === selectedProduct);

      const renderCards = () => {
        const shown = visibleByProduct().filter((item) => {
          const categoryMatch = selectedCategory === "すべて" || majorOf(item) === selectedCategory;
          const searchable = `${item.number} ${item.title} ${item.category}`.toLowerCase();
          return categoryMatch && searchable.includes(keyword);
        });
        text(count, `${shown.length} 件を表示しています`);
        list.replaceChildren(...shown.map((item) => {
          const link = document.createElement("a");
          link.className = "lesson-card";
          link.href = `lesson.html?id=${encodeURIComponent(item.id)}`;
          const number = text(document.createElement("span"), `No.${String(item.number).padStart(2, "0")}`);
          number.className = "number";
          const title = text(document.createElement("h3"), item.title);
          const meta = document.createElement("p");
          meta.className = "meta";
          const category = text(document.createElement("span"), item.category);
          category.className = "category";
          meta.append(category, document.createTextNode(` ｜ ${item.slides} スライド`));
          link.append(number, title, meta);
          return link;
        }));
      };

      const renderCategoryTabs = () => {
        const categories = [...new Set(visibleByProduct().map(majorOf))];
        categoryTabs.replaceChildren(...["すべて", ...categories].map((label) => makeTab(label, label === selectedCategory, () => {
          selectedCategory = label;
          renderCategoryTabs();
          renderCards();
        })));
      };

      productTabs.replaceChildren(...["すべて", ...products].map((product) => {
        const total = product === "すべて" ? items.length : items.filter((item) => productOf(item) === product).length;
        const label = product === "すべて" ? `すべて（${total}）` : `${product}（${total}）`;
        return makeTab(label, product === selectedProduct, () => {
          selectedProduct = product;
          selectedCategory = "すべて";
          productTabs.replaceChildren(...["すべて", ...products].map((next) => {
            const nextTotal = next === "すべて" ? items.length : items.filter((item) => productOf(item) === next).length;
            const nextLabel = next === "すべて" ? `すべて（${nextTotal}）` : `${next}（${nextTotal}）`;
            return makeTab(nextLabel, next === selectedProduct, () => {
              selectedProduct = next;
              selectedCategory = "すべて";
              renderCategoryTabs();
              renderCards();
              productTabs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === (next === "すべて" ? `すべて（${nextTotal}）` : `${next}（${nextTotal}）`))));
            });
          }));
          renderCategoryTabs();
          renderCards();
        });
      }));

      search.addEventListener("input", () => {
        keyword = search.value.trim().toLowerCase();
        renderCards();
      });
      renderCategoryTabs();
      renderCards();
    } catch (error) {
      showError(list, error.message);
    }
  }

  function splitSlides(markdown) {
    const matches = [...markdown.matchAll(/^###\s+(.+)$/gm)];
    if (!matches.length) return [{ heading: "研修資料", copyText: markdown }];
    const intro = markdown.slice(0, matches[0].index).trim();
    return matches.map((match, index) => {
      const start = match.index;
      const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
      return { heading: match[1].trim(), copyText: `${index === 0 && intro ? `${intro}\n\n` : ""}${markdown.slice(start, end).trim()}` };
    });
  }

  async function renderLesson() {
    const hero = document.querySelector("#lesson-hero");
    const slidesTarget = document.querySelector("#slides");
    const slideNav = document.querySelector("#slide-nav");
    const rawSource = document.querySelector("#raw-source");
    const copyAll = document.querySelector("#copy-all");
    const status = document.querySelector("#copy-status");
    const id = new URLSearchParams(window.location.search).get("id");
    try {
      const items = await getManifest();
      const item = items.find((candidate) => candidate.id === id);
      if (!item) throw new Error("指定された研修資料は見つかりませんでした。一覧から選び直してください。");
      const response = await fetch(item.path);
      if (!response.ok) throw new Error("研修資料を読み込めませんでした。");
      const markdown = (await response.text()).replace(/\r\n/g, "\n");
      const slides = splitSlides(markdown);
      document.title = `No.${String(item.number).padStart(2, "0")} ${item.title} | Windows 研修資料`;
      rawSource.href = item.path;
      const number = text(document.createElement("p"), `No.${String(item.number).padStart(2, "0")}｜${item.category}`);
      number.className = "lesson-number";
      const title = text(document.createElement("h1"), item.title);
      const meta = text(document.createElement("p"), `${item.slides} スライド｜元PowerPointのレイアウトをそのまま表示`);
      meta.className = "lesson-meta";
      hero.append(number, title, meta);
      copyAll.addEventListener("click", () => copyToClipboard(markdown, status));
      for (let index = 0; index < item.slides; index += 1) {
        const slide = slides[index] ?? { copyText: markdown };
        const anchor = document.createElement("a");
        anchor.href = `#slide-${index + 1}`;
        text(anchor, String(index + 1));
        slideNav.append(anchor);
        const card = document.createElement("article");
        card.className = "slide-card slide-image-card";
        card.id = `slide-${index + 1}`;
        const top = document.createElement("div");
        top.className = "slide-topline";
        const indexLabel = text(document.createElement("span"), `スライド ${index + 1} / ${item.slides}`);
        indexLabel.className = "slide-index";
        const button = text(document.createElement("button"), "このスライドの原稿をコピー");
        button.type = "button";
        button.className = "button slide-copy";
        button.addEventListener("click", () => copyToClipboard(slide.copyText, status));
        top.append(indexLabel, button);
        const image = document.createElement("img");
        image.className = "slide-image";
        image.src = `assets/slides/${item.id}/slide-${index + 1}.png`;
        image.alt = `No.${String(item.number).padStart(2, "0")} ${item.title}：スライド ${index + 1}`;
        image.decoding = "async";
        image.loading = "eager";
        card.append(top, image);
        slidesTarget.append(card);
      }
    } catch (error) {
      showError(hero, error.message);
      copyAll.disabled = true;
      rawSource.hidden = true;
    }
  }

  if (document.body.dataset.page === "home") renderHome();
  if (document.body.dataset.page === "lesson") renderLesson();
})();
