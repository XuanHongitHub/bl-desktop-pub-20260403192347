(() => {
  "use strict";

  const config = window.PANEL_CONFIG;
  if (!config) {
    throw new Error("PANEL_CONFIG is required");
  }

  const storageKey = config.storageKey || "panel.preview";

  const refs = {
    brandTitle: document.getElementById("brandTitle"),
    brandSubtitle: document.getElementById("brandSubtitle"),
    treeRoot: document.getElementById("treeRoot"),
    pageTitle: document.getElementById("pageTitle"),
    pageSummary: document.getElementById("pageSummary"),
    metaTags: document.getElementById("metaTags"),
    kpiGrid: document.getElementById("kpiGrid"),
    toolbarSearch: document.getElementById("toolbarSearch"),
    toolbarFilter: document.getElementById("toolbarFilter"),
    toolbarActions: document.getElementById("toolbarActions"),
    dataTableHead: document.getElementById("dataTableHead"),
    dataTableBody: document.getElementById("dataTableBody"),
    timeline: document.getElementById("timeline"),
    stateSwitch: document.getElementById("stateSwitch"),
    stateCanvas: document.getElementById("stateCanvas"),
    patterns: document.getElementById("patterns"),
    featureList: document.getElementById("featureList"),
  };

  const pages = config.groups.flatMap((group) =>
    group.pages.map((page) => ({
      ...page,
      groupId: group.id,
      groupLabel: group.label,
    })),
  );

  const ui = loadUI();
  ensureValidUI();

  refs.brandTitle.textContent = config.panelName;
  refs.brandSubtitle.textContent = config.panelScope;

  bindEvents();
  render();

  function loadUI() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return {
          pageId: pages[0]?.id || "",
          collapsed: {},
          state: "default",
        };
      }
      const parsed = JSON.parse(raw);
      return {
        pageId: parsed.pageId || pages[0]?.id || "",
        collapsed: parsed.collapsed || {},
        state: parsed.state || "default",
      };
    } catch (_error) {
      return {
        pageId: pages[0]?.id || "",
        collapsed: {},
        state: "default",
      };
    }
  }

  function saveUI() {
    localStorage.setItem(storageKey, JSON.stringify(ui));
  }

  function ensureValidUI() {
    if (!pages.some((page) => page.id === ui.pageId)) {
      ui.pageId = pages[0]?.id || "";
    }
  }

  function bindEvents() {
    document.getElementById("expandAll").addEventListener("click", () => {
      config.groups.forEach((group) => {
        ui.collapsed[group.id] = false;
      });
      saveUI();
      renderTree();
    });

    document.getElementById("collapseAll").addEventListener("click", () => {
      config.groups.forEach((group) => {
        ui.collapsed[group.id] = true;
      });
      saveUI();
      renderTree();
    });

    document.getElementById("searchNav").addEventListener("input", (event) => {
      renderTree(String(event.target.value || "").trim().toLowerCase());
    });

    refs.stateSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-state]");
      if (!button) {
        return;
      }
      ui.state = String(button.dataset.state || "default");
      saveUI();
      renderStateSwitch();
      renderStateCanvas();
    });
  }

  function render() {
    renderTree();
    renderPage();
  }

  function renderTree(query = "") {
    refs.treeRoot.innerHTML = "";

    config.groups.forEach((group) => {
      const groupMatches = !query || `${group.label} ${group.summary || ""}`.toLowerCase().includes(query);
      const visiblePages = group.pages.filter((page) => {
        if (!query) {
          return true;
        }
        return `${page.title} ${page.code} ${page.summary}`.toLowerCase().includes(query) || groupMatches;
      });

      if (!visiblePages.length) {
        return;
      }

      const section = document.createElement("section");
      section.className = "group";

      const headButton = document.createElement("button");
      const isCollapsed = Boolean(ui.collapsed[group.id]);
      headButton.textContent = `${isCollapsed ? "▸" : "▾"} ${group.label}`;
      headButton.addEventListener("click", () => {
        ui.collapsed[group.id] = !Boolean(ui.collapsed[group.id]);
        saveUI();
        renderTree(query);
      });
      section.appendChild(headButton);

      if (!isCollapsed) {
        const ul = document.createElement("ul");
        ul.className = "group-pages";

        visiblePages.forEach((page) => {
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.classList.toggle("active", page.id === ui.pageId);
          btn.innerHTML = `<strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.code)} · ${escapeHtml(page.priority.toUpperCase())}</small>`;
          btn.addEventListener("click", () => {
            ui.pageId = page.id;
            saveUI();
            renderPage();
            renderTree(query);
          });
          li.appendChild(btn);
          ul.appendChild(li);
        });

        section.appendChild(ul);
      }

      refs.treeRoot.appendChild(section);
    });
  }

  function renderPage() {
    const page = pages.find((item) => item.id === ui.pageId);
    if (!page) {
      return;
    }

    refs.pageTitle.textContent = page.title;
    refs.pageSummary.textContent = page.summary;

    refs.metaTags.innerHTML = "";
    [
      { text: page.code, cls: "" },
      { text: page.groupLabel, cls: "" },
      { text: `Owner: ${page.owner}`, cls: "" },
      { text: page.priority.toUpperCase(), cls: `priority-${page.priority}` },
    ].forEach((tag) => {
      const span = document.createElement("span");
      span.className = tag.cls;
      span.textContent = tag.text;
      refs.metaTags.appendChild(span);
    });

    refs.kpiGrid.innerHTML = "";
    (page.kpis || []).slice(0, 4).forEach((kpi) => {
      const item = document.createElement("article");
      item.className = "kpi";
      item.innerHTML = `<label>${escapeHtml(kpi.label)}</label><strong>${escapeHtml(kpi.value)}</strong>`;
      refs.kpiGrid.appendChild(item);
    });

    refs.toolbarSearch.placeholder = page.searchPlaceholder || "Search...";
    refs.toolbarFilter.innerHTML = "";
    (page.filters || []).forEach((filter) => {
      const option = document.createElement("option");
      option.value = filter;
      option.textContent = filter;
      refs.toolbarFilter.appendChild(option);
    });

    refs.toolbarActions.innerHTML = "";
    (page.actions || []).forEach((action, index) => {
      const button = document.createElement("button");
      button.className = `btn ${index === 0 ? "btn-primary" : ""}`.trim();
      button.textContent = action;
      refs.toolbarActions.appendChild(button);
    });

    renderTable(page);
    renderTimeline(page);
    renderPatterns(page);
    renderFeatureList(page);
    renderStateSwitch();
    renderStateCanvas();
  }

  function renderTable(page) {
    refs.dataTableHead.innerHTML = "";
    refs.dataTableBody.innerHTML = "";

    (page.table.columns || []).forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      refs.dataTableHead.appendChild(th);
    });

    (page.table.rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.innerHTML = cell;
        tr.appendChild(td);
      });
      refs.dataTableBody.appendChild(tr);
    });
  }

  function renderTimeline(page) {
    refs.timeline.innerHTML = "";
    (page.timeline || []).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.time)}</span>`;
      refs.timeline.appendChild(li);
    });
  }

  function renderPatterns(page) {
    refs.patterns.innerHTML = "";
    (page.uxPatterns || []).forEach((pattern) => {
      const span = document.createElement("span");
      span.textContent = pattern;
      refs.patterns.appendChild(span);
    });
  }

  function renderFeatureList(page) {
    refs.featureList.innerHTML = "";
    (page.featureMap || []).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = item;
      refs.featureList.appendChild(li);
    });
  }

  function renderStateSwitch() {
    const buttons = Array.from(refs.stateSwitch.querySelectorAll("button[data-state]"));
    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.state === ui.state);
    });
  }

  function renderStateCanvas() {
    const state = ui.state;
    if (state === "loading") {
      refs.stateCanvas.innerHTML = "Loading state: skeleton rows + disabled buttons + progress hint.";
      return;
    }
    if (state === "empty") {
      refs.stateCanvas.innerHTML = "Empty state: không có dữ liệu phù hợp filter, hiển thị CTA tạo mới rõ ràng.";
      return;
    }
    if (state === "error") {
      refs.stateCanvas.innerHTML = "Error state: banner lỗi gọn + Retry button + link tới audit/event details.";
      return;
    }
    refs.stateCanvas.innerHTML = "Default state: dữ liệu đầy đủ, compact table + toolbar actions + timeline insights.";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
