/*
 * Modern application shell
 * ------------------------
 * This file deliberately contains only presentation and navigation concerns.
 * Fachmodule remain in app.js. A future module therefore needs only a primary
 * navigation button and its existing data-module-owner tabs to participate in
 * the sidebar, breadcrumb and horizontal page navigation.
 */
(function () {
  "use strict";

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>',
    bidder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/><path d="m15 3 3 3"/></svg>',
    projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V5h7l2 2"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/></svg>',
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6M7 17h3"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2M12 17h.01"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2.1-.6a7 7 0 0 0-.8-1.9l1.1-1.9-2.1-2.1-1.9 1.1a7 7 0 0 0-1.9-.8L10.5 2h-3L7 4.2A7 7 0 0 0 5.1 5L3.2 4 1 6.1 2.1 8a7 7 0 0 0-.8 1.9L0 10.5v3l2.1.6a7 7 0 0 0 .8 1.9l-1.1 1.9L4 20l1.9-1.1a7 7 0 0 0 1.9.8l.7 2.3h3l.6-2.1a7 7 0 0 0 1.9-.8l1.9 1.1 2.1-2.1-1.1-1.9a7 7 0 0 0 .8-1.9z" transform="translate(2) scale(.83)"/></svg>',
    account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };

  const PAGE_LABELS = {
    dashboard: "Hauptseite",
    generator: "E-Mail erstellen",
    templates: "E-Mail-Vorlagen",
    "template-edit": "Vorlage bearbeiten",
    categories: "Mailkategorien",
    "document-create": "Dokument erstellen",
    "document-templates": "Dokumentvorlagen",
    "document-template-edit": "Dokumentvorlage bearbeiten",
    "document-blocks": "Textbausteine",
    "bid-questions": "Bieterfragen – Gesamtübersicht",
    "bid-question-create": "Bieterfrage erfassen",
    "bid-question-batch": "Batch-Erfassung",
    "bid-question-import": "Excel-Import",
    "bid-answers": "Standardantworten",
    "bid-answer-create": "Standardantwort anlegen",
    "bid-taxonomy": "Kategorien und Themen",
    "project-overview": "Projektübersicht",
    "project-detail": "Projekt",
    "project-create": "Projekt anlegen",
    bidders: "Bieterverzeichnis",
    "bidder-create": "Bieter anlegen",
    variables: "Platzhalter",
    users: "Benutzer",
    roles: "Rollen und Berechtigungen",
    "system-status": "Systemstatus",
    audit: "Änderungsprotokoll",
    usage: "Nutzungsauswertung",
    settings: "Einstellungen",
    account: "Mein Konto",
    help: "Hilfe",
    "excel-import": "Projekt aus Excel übernehmen"
  };

  const MODULE_LABELS = {
    dashboard: "Hauptseite",
    email: "E-Mail-Vorlagen",
    documents: "Dokumente",
    bidder: "Bieterfragen",
    projects: "Projekte",
    users: "Benutzerverwaltung",
    system: "System",
    help: "Hilfe"
  };

  function iconMarkup(name) {
    return `<span class="nav-icon">${ICONS[name] || ICONS.help}</span>`;
  }

  let expandedModule = null;
  let activeTab = "dashboard";

  // Expansion and page navigation deliberately have separate controls. Only
  // one group is expanded, including when navigation starts from a deep link.
  function setExpandedModule(module) {
    expandedModule = module;
    document.querySelectorAll(".sidebar-submenu").forEach(menu => {
      menu.hidden = menu.dataset.sidebarModule !== module;
    });
    document.querySelectorAll("[data-expand-module]").forEach(button => {
      const open = button.dataset.expandModule === module;
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", `${MODULE_LABELS[button.dataset.expandModule]} ${open ? "zuklappen" : "aufklappen"}`);
    });
  }

  function closeFlyout() {
    const menu = document.getElementById("navigationFlyout");
    if (menu?.matches(":popover-open")) menu.hidePopover();
  }

  function openFlyout(module, button) {
    const menu = document.getElementById("navigationFlyout");
    const alreadyOpen = menu.matches(":popover-open") && menu.dataset.module === module;
    closeFlyout();
    if (alreadyOpen) return;
    menu.replaceChildren();
    menu.dataset.module = module;
    const heading = document.createElement("strong");
    heading.textContent = MODULE_LABELS[module];
    menu.append(heading);
    document.querySelectorAll(`#subNav [data-module-owner="${module}"]`).forEach(source => {
      if (!window.moduleButtonAllowed?.(source)) return;
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = source.textContent;
      item.classList.toggle("active", source.dataset.tab === (activeTab === "template-edit" ? "templates" : activeTab === "document-template-edit" ? "document-templates" : activeTab));
      item.onclick = () => { closeFlyout(); source.click(); };
      menu.append(item);
    });
    menu.showPopover();
    const rect = button.getBoundingClientRect();
    menu.style.left = `${document.getElementById("appSidebar").getBoundingClientRect().right + 8}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - menu.offsetHeight - 12))}px`;
  }

  function setCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    closeFlyout();
    const button = document.getElementById("sidebarCollapseButton");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "Navigation ausklappen" : "Navigation einklappen";
    button.setAttribute("aria-label", button.title);
  }

  function decorateNavigation() {
    const moduleNav = document.getElementById("moduleNav");
    const subNav = document.getElementById("subNav");
    if (!moduleNav || !subNav || moduleNav.dataset.enhanced) return;
    moduleNav.dataset.enhanced = "true";

    moduleNav.querySelectorAll(":scope > button").forEach((button) => {
      const key = button.dataset.navKey || "help";
      const label = button.textContent.trim();
      const row = document.createElement("div");
      row.className = "nav-main-row";
      button.before(row);
      row.append(button);
      button.title = label;
      button.innerHTML = `${iconMarkup(key)}<span class="nav-label">${label}</span>`;

      const module = button.dataset.module;
      if (!module) return;
      const submenu = document.createElement("div");
      submenu.className = "sidebar-submenu";
      submenu.dataset.sidebarModule = module;
      submenu.id = `sidebar-submenu-${module}`;
      submenu.hidden = true;

      subNav.querySelectorAll(`[data-module-owner="${module}"]`).forEach((source) => {
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = source.textContent.trim();
        item.dataset.shellTab = source.dataset.tab;
        item.addEventListener("click", () => source.click());
        submenu.appendChild(item);
      });
      row.after(submenu);
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "nav-expand";
      expand.dataset.expandModule = module;
      expand.setAttribute("aria-controls", submenu.id);
      expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';
      expand.onclick = () => setExpandedModule(expandedModule === module ? null : module);
      row.append(expand);
      button.onclick = () => {
        if (document.body.classList.contains("sidebar-collapsed") && window.innerWidth > 980) openFlyout(module, button);
        else window.openModule?.(module);
      };
    });

    document.querySelectorAll("[data-shell-icon]").forEach((button) => {
      const label = button.textContent.trim();
      button.title = label;
      button.innerHTML = `${iconMarkup(button.dataset.shellIcon)}<span class="nav-label">${label}</span>`;
    });
    setExpandedModule(null);
  }

  function syncSidebarPermissions() {
    document.querySelectorAll(".sidebar-submenu button[data-shell-tab]").forEach((item) => {
      const source = document.querySelector(`#subNav button[data-tab="${item.dataset.shellTab}"]`);
      item.hidden = !source || !window.moduleButtonAllowed?.(source);
    });
    document.querySelectorAll(".nav-main-row").forEach(row => {
      row.hidden = !!row.querySelector("[data-nav-key]")?.hidden;
    });
  }

  function closeMobileSidebar() {
    document.body.classList.remove("sidebar-open");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (backdrop) backdrop.hidden = true;
  }

  function openMobileSidebar() {
    document.body.classList.add("sidebar-open");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (backdrop) backdrop.hidden = false;
  }

  function updateAppShell(tab, module) {
    activeTab = tab;
    const title = PAGE_LABELS[tab] || "Wieseke Vorlagen-Engine";
    const moduleLabel = MODULE_LABELS[module] || title;
    const pageTitle = document.getElementById("pageTitle");
    const breadcrumb = document.getElementById("pageBreadcrumb");
    if (pageTitle) pageTitle.textContent = title;
    if (breadcrumb) {
      breadcrumb.innerHTML = module && moduleLabel !== title
        ? `<button type="button" data-breadcrumb-module="${module}">${moduleLabel}</button><span aria-hidden="true">›</span><strong>${title}</strong>`
        : `<strong>${title}</strong>`;
      breadcrumb.querySelector("button")?.addEventListener("click", () => window.openModule?.(module));
    }

    document.querySelectorAll(".sidebar-submenu button[data-shell-tab]").forEach((item) => {
      item.classList.toggle("active", item.dataset.shellTab === (tab === "template-edit" ? "templates" : tab === "document-template-edit" ? "document-templates" : tab));
    });
    document.querySelectorAll(".sidebar-footer-action[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    setExpandedModule(module);
    closeFlyout();
    closeMobileSidebar();
  }

  function initializeShell() {
    decorateNavigation();
    const collapse = document.createElement("button");
    collapse.id = "sidebarCollapseButton";
    collapse.type = "button";
    collapse.className = "navigation-collapse";
    collapse.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v18H4ZM9 3v18m7-13-4 4 4 4"/></svg>';
    document.getElementById("sidebarCloseButton").before(collapse);
    const flyout = document.createElement("nav");
    flyout.id = "navigationFlyout";
    flyout.setAttribute("popover", "auto");
    flyout.setAttribute("aria-label", "Unterseiten");
    document.body.append(flyout);
    collapse.onclick = () => {
      const collapsed = !document.body.classList.contains("sidebar-collapsed");
      setCollapsed(collapsed);
      try { localStorage.setItem("wve-sidebar-collapsed", String(collapsed)); } catch (_) { /* Navigation also works without browser storage. */ }
    };
    setCollapsed(false);
    try { setCollapsed(localStorage.getItem("wve-sidebar-collapsed") === "true"); } catch (_) {}
    syncSidebarPermissions();
    document.getElementById("sidebarOpenButton")?.addEventListener("click", openMobileSidebar);
    document.getElementById("sidebarCloseButton")?.addEventListener("click", closeMobileSidebar);
    document.getElementById("sidebarBackdrop")?.addEventListener("click", closeMobileSidebar);
    window.addEventListener("resize", () => { closeFlyout(); if (window.innerWidth > 980) closeMobileSidebar(); });
    document.getElementById("moduleNav").addEventListener("scroll", closeFlyout);
  }

  window.updateAppShell = updateAppShell;
  window.refreshShellPermissions = syncSidebarPermissions;
  window.closeMobileSidebar = closeMobileSidebar;
  document.addEventListener("DOMContentLoaded", initializeShell);
})();
