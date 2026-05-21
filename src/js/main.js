// Highlight active nav item based on current page
(function initNav() {
  const currentPath = window.location.pathname;
  const page = currentPath.split('/').pop() || 'index.html';
  const pageName = page.replace('.html', '');

  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.getAttribute('data-page') === pageName) {
      el.classList.add('active');
    }
  });
})();

const App = {
  // Desktop sidebar — toggle collapse/expand
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('toggleIcon');
    if (!sidebar) return;

    const isExpanded = sidebar.classList.toggle('expanded');

    // Rotate icon arrow
    if (icon) {
      icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      icon.style.transition = 'transform 0.2s ease';
    }
  },

  // Mobile menu toggle
  toggleMobileMenu() {
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle('open');
    if (overlay) {
      overlay.style.display = isOpen ? 'block' : 'none';
    }
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
};
