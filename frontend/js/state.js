/**
 * SchemaSay — Centralized Application State
 * Single source of truth for all UI state.
 */

const AppState = (() => {
  // ----- Core State Object -----
  const _state = {
    user: null,
    authToken: null,
    refreshToken: null,

    activeConnection: null,
    connections: [],

    schema: {},          // { tableName: [{ name, type, pk, fk }] }
    selectedTable: null,

    currentQuery: null,  // The current natural-language question or SQL fallback
    currentSql: null,
    queryResult: null,   // { columns, rows, rowCount, executionTime, chartConfig }
    queryHistory: [],

    currentView: 'dashboard',   // dashboard | workbench | connections | schema | history | insights | settings
    currentDashboardMode: 'copilot',  // copilot | workbench

    isExecuting: false,
    isLoadingSchema: false,
    isGeneratingInsights: false,
    isSyncingSchema: false,

    insights: [],
    currentInsight: null,

    theme: 'light',   // light | dark

    processingStages: [],  // For AI copilot stage animation
  };

  // ----- Subscribers -----
  const _subscribers = {};

  // ----- Internal Helpers -----
  function _notify(key) {
    if (_subscribers[key]) {
      _subscribers[key].forEach(fn => fn(_state[key], _state));
    }
    // Always notify wildcard listeners
    if (_subscribers['*']) {
      _subscribers['*'].forEach(fn => fn(key, _state[key], _state));
    }
  }

  // ----- Public API -----
  return {
    /**
     * Get the full state snapshot
     */
    getState() {
      return { ..._state };
    },

    /**
     * Get a single state key
     */
    get(key) {
      return _state[key];
    },

    /**
     * Set one or more state keys and notify subscribers
     */
    set(updates) {
      const changedKeys = [];
      Object.entries(updates).forEach(([key, value]) => {
        if (_state[key] !== value) {
          _state[key] = value;
          changedKeys.push(key);
        }
      });
      changedKeys.forEach(key => _notify(key));
      return this;
    },

    /**
     * Subscribe to a specific key change
     * @param {string} key - state key or '*' for all
     * @param {Function} fn - callback
     * @returns {Function} - unsubscribe function
     */
    subscribe(key, fn) {
      if (!_subscribers[key]) _subscribers[key] = [];
      _subscribers[key].push(fn);
      return () => {
        _subscribers[key] = _subscribers[key].filter(f => f !== fn);
      };
    },

    /**
     * Reset state (on logout)
     */
    reset() {
      const keysToReset = [
        'user', 'authToken', 'refreshToken', 'activeConnection',
 'connections',
        'schema', 'selectedTable', 'currentQuery', 'currentSql', 'queryResult',
        'queryHistory', 'insights', 'currentInsight',
        'isExecuting', 'isLoadingSchema', 'isGeneratingInsights', 'isSyncingSchema',
        'processingStages',
      ];
      const resetObj = {};
      keysToReset.forEach(k => {
        if (Array.isArray(_state[k])) resetObj[k] = [];
        else if (typeof _state[k] === 'boolean') resetObj[k] = false;
        else if (typeof _state[k] === 'object' && _state[k] !== null) resetObj[k] = {};
        else resetObj[k] = null;
      });
      this.set(resetObj);
    },

    /**
     * Persist theme to localStorage
     */
    saveTheme(theme) {
      this.set({ theme });
      try { localStorage.setItem('ss_theme', theme); } catch(e) {}
    },

    /**
     * Load persisted theme
     */
    loadTheme() {
      try {
        const t = localStorage.getItem('ss_theme');
        if (t === 'dark' || t === 'light') this.set({ theme: t });
      } catch(e) {}
    },

    /**
     * Keep the short-lived access token in memory only.
     * The refresh token is the only credential persisted for this tab.
     */
    saveToken(token) {
      this.set({ authToken: token });
    },

    saveRefreshToken(token) {
      this.set({ refreshToken: token });
      try { sessionStorage.setItem('ss_refresh_token', token); } catch(e) {}
    },

    /**
     * Load the refresh token persisted for this tab.
     * Access tokens are intentionally not restored from browser storage.
     */
    loadToken() {
      try {
        const r = sessionStorage.getItem('ss_refresh_token');
        if (r) this.set({ refreshToken: r });
        return this.get('authToken');
      } catch(e) { return this.get('authToken'); }
    },

    /**
     * Clear persisted token
     */
    clearToken() {
      this.set({ authToken: null, refreshToken: null });
      try {
        sessionStorage.removeItem('ss_token');
        sessionStorage.removeItem('ss_refresh_token');
      } catch(e) {}
    },
  };
})();
