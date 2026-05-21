// Highlight active nav item based on current page
(function initNav() {
  const currentPath = window.location.pathname;
  const page = currentPath.split('/').pop() || 'index.html';
  const pageName = page.replace('.html', '');

  document.querySelectorAll('[data-page]').forEach(link => {
    if (link.getAttribute('data-page') === pageName) {
      link.classList.add('active');
    }
  });
})();

// App namespace
const App = {
  // Desktop sidebar collapse/expand
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('expanded');
  },

  // Mobile menu toggle
  toggleMobileMenu() {
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.mobile-sidebar-overlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      if (overlay) overlay.style.display = 'none';
      document.body.style.overflow = '';
    } else {
      sidebar.classList.add('open');
      if (overlay) overlay.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  }
};
