(function () {
  "use strict";

  if (typeof document === "undefined") {
    return;
  }

  var toggle = document.querySelector(".mobile-menu-toggle");
  var navigation = document.getElementById("mobile-navigation");

  if (!toggle || !navigation) {
    return;
  }

  function closeMenu() {
    toggle.setAttribute("aria-expanded", "false");
    navigation.hidden = true;
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    toggle.setAttribute("aria-expanded", "true");
    navigation.hidden = false;
    document.body.classList.add("menu-open");
  }

  toggle.addEventListener("click", function () {
    if (toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
    } else {
      openMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      toggle.focus();
    }
  });

  navigation.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });
})();
