(function () {
  "use strict";

  var root = document.documentElement;
  var themeKey = "buglogin-html-theme";
  var menuKey = "buglogin-html-menu-open";

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(themeKey, theme);
    var toggles = document.querySelectorAll("[data-theme-toggle]");
    toggles.forEach(function (button) {
      button.textContent = theme === "dark" ? "Light" : "Dark";
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      );
    });
  }

  function initTheme() {
    var stored = localStorage.getItem(themeKey);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function initThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var current = root.getAttribute("data-theme") || "light";
        setTheme(current === "dark" ? "light" : "dark");
      });
    });
  }

  function initNavActive() {
    var path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link[data-page]").forEach(function (link) {
      var isActive = link.getAttribute("data-page") === path;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function initPricingToggle() {
    var prices = document.querySelectorAll("[data-price-month]");
    if (!prices.length) {
      return;
    }

    var pills = document.querySelectorAll(".pill[data-cycle]");
    var current = "monthly";

    function render() {
      pills.forEach(function (pill) {
        var active = pill.getAttribute("data-cycle") === current;
        pill.classList.toggle("active", active);
        pill.setAttribute("aria-pressed", active ? "true" : "false");
      });

      prices.forEach(function (node) {
        var monthValue = node.getAttribute("data-price-month") || "0";
        var yearValue = node.getAttribute("data-price-year") || "0";
        node.textContent = current === "monthly" ? monthValue : yearValue;
      });
    }

    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        current = pill.getAttribute("data-cycle") || "monthly";
        render();
      });
    });

    render();
  }

  function initMobileMenu() {
    var toggle = document.querySelector("[data-mobile-toggle]");
    var nav = document.querySelector("[data-mobile-nav]");
    if (!toggle || !nav) {
      return;
    }

    function render(opened) {
      nav.style.display = opened ? "flex" : "none";
      toggle.setAttribute("aria-expanded", opened ? "true" : "false");
      localStorage.setItem(menuKey, opened ? "1" : "0");
    }

    var fromStorage = localStorage.getItem(menuKey) === "1";
    render(fromStorage);

    toggle.addEventListener("click", function () {
      var opened = toggle.getAttribute("aria-expanded") === "true";
      render(!opened);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) {
        nav.style.display = "";
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function init() {
    initTheme();
    initThemeToggle();
    initNavActive();
    initPricingToggle();
    initMobileMenu();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
