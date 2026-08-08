/**
 * SchemaSay — SPA Router
 * Hash-based routing for single page navigation.
 */

const Router = (() => {
  const _routes = {};
  let _currentRoute = null;

  function _getHash() {
    return window.location.hash.replace('#', '') || 'dashboard';
  }

  function _navigate(route, params = {}) {
    // Map tool shortcuts
    const routeMap = {
      'copilot':   'dashboard',
      'workbench': 'workbench',
    };
    const canonical = routeMap[route] || route;

    if (_routes[canonical]) {
      _currentRoute = canonical;
      _routes[canonical](params);
      AppState.set({ currentView: canonical });
    } else if (_routes['404']) {
      _routes['404']();
    } else {
      // fallback
      console.warn(`[Router] No route registered for: "${canonical}"`);
    }
  }

  // Listen to hash changes
  window.addEventListener('hashchange', () => {
    const hash = _getHash();
    _navigate(hash);
  });

  return {
    /**
     * Register a route handler
     * @param {string} path
     * @param {Function} handler
     */
    on(path, handler) {
      _routes[path] = handler;
      return this;
    },

    /**
     * Navigate to a route programmatically
     * @param {string} path
     * @param {Object} params
     */
    navigate(path, params = {}) {
      window.location.hash = '#' + path;
      _navigate(path, params);
    },

    /**
     * Start the router — process current hash
     */
    start() {
      const hash = _getHash();
      _navigate(hash);
    },

    /**
     * Get current active route
     */
    get current() {
      return _currentRoute;
    },
  };
})();
