(function () {
  "use strict";

  if (typeof document === "undefined") {
    return;
  }

  var root = document.documentElement;

  /* ---------- Theme toggle ---------- */
  var themeButton = document.getElementById("theme-toggle");

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
  }

  function storedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* storage unavailable; keep the in-memory theme for this page */
    }
  }

  if (themeButton) {
    if (!root.getAttribute("data-theme")) {
      applyTheme(storedTheme() || systemTheme());
    }

    themeButton.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
    });

    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function (event) {
      if (!storedTheme()) {
        applyTheme(event.matches ? "light" : "dark");
      }
    });
  }

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.getElementById("nav-toggle");
  var navList = document.getElementById("site-menu");

  if (navToggle && navList) {
    var closeNav = function () {
      navList.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
    };

    navToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      var open = navList.classList.toggle("active");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (event) {
      if (navList.classList.contains("active") && !event.target.closest(".site-nav")) {
        closeNav();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navList.classList.contains("active")) {
        closeNav();
        navToggle.focus();
      }
    });

    navList.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        closeNav();
      }
    });
  }

  /* ---------- Scroll to top ---------- */
  var scrollButton = document.getElementById("scroll-top");

  if (scrollButton) {
    var threshold = 300;

    var onScroll = function () {
      scrollButton.classList.toggle("visible", window.scrollY > threshold);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    scrollButton.addEventListener("click", function () {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }
})();
