/**
 * SchemaSay — UI Utilities
 * Toast system, modal helpers, loading states, DOM helpers.
 */

// ============================================================
// TOAST SYSTEM
// ============================================================

const Toast = (() => {
  let container = null;

  function _getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
    }
    return container;
  }

  function show(message, type = 'info', duration = 3500) {
    const c = _getContainer();
    if (!c) return;

    const icons = {
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
      error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const colors = {
      success: '#15803D',
      error:   '#DC2626',
      warning: '#D97706',
      info:    '#1AAE9F',
    };

    const safeType = colors[type] ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `toast toast-${safeType}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.style.color = colors[safeType];
    icon.innerHTML = icons[safeType];

    const messageEl = document.createElement('span');
    messageEl.className = 'toast-message';
    messageEl.textContent = String(message ?? '');

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    toast.append(icon, messageEl, close);

    const dismiss = () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    c.appendChild(toast);

    if (duration > 0) setTimeout(dismiss, duration);
    return toast;
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur || 5000),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info',    dur),
  };
})();


// ============================================================
// MODAL SYSTEM
// ============================================================

const Modal = {
  open(modalId) {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      // Focus first focusable element
      const focusable = backdrop.querySelector('button, input, select, textarea, [tabindex]');
      if (focusable) setTimeout(() => focusable.focus(), 50);
    }
  },

  close(modalId) {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },

  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(el => {
      el.classList.add('hidden');
    });
    document.body.style.overflow = '';
  },
};

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    Modal.closeAll();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Modal.closeAll();
});


// ============================================================
// DROPDOWN SYSTEM
// ============================================================

const Dropdown = {
  open(triggerId, menuId) {
    const menu = document.getElementById(menuId);
    if (menu) {
      menu.classList.remove('hidden');
      // Auto-close when clicking outside
      const handler = (e) => {
        const trigger = document.getElementById(triggerId);
        if (!menu.contains(e.target) && !trigger?.contains(e.target)) {
          this.close(menuId);
          document.removeEventListener('click', handler);
        }
      };
      setTimeout(() => document.addEventListener('click', handler), 0);
    }
  },

  close(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) menu.classList.add('hidden');
  },

  toggle(triggerId, menuId) {
    const menu = document.getElementById(menuId);
    if (menu?.classList.contains('hidden')) {
      this.open(triggerId, menuId);
    } else {
      this.close(menuId);
    }
  },
};


// ============================================================
// LOADING STATE HELPERS
// ============================================================

const Loading = {
  /**
   * Show a spinner button loading state
   */
  setButton(btn, loadingText = 'Loading...') {
    if (!btn) return;
    btn._originalHTML = btn.innerHTML;
    btn._originalDisabled = btn.disabled;
    btn.disabled = true;
    btn.innerHTML = `
      <span class="spinner sm white"></span>
      <span>${loadingText}</span>
    `;
  },

  /**
   * Restore a button to its original state
   */
  resetButton(btn) {
    if (!btn || !btn._originalHTML) return;
    btn.disabled = btn._originalDisabled || false;
    btn.innerHTML = btn._originalHTML;
    btn._originalHTML = null;
  },

  /**
   * Render skeleton rows in a container
   */
  showSkeleton(container, rows = 3) {
    if (!container) return;
    container.innerHTML = Array(rows).fill(0).map(() => `
      <div style="display:flex;gap:12px;padding:12px;align-items:center;">
        <div class="skeleton skeleton-text" style="width:24px;height:24px;border-radius:50%;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <div class="skeleton skeleton-text" style="width:60%;"></div>
          <div class="skeleton skeleton-text" style="width:35%;"></div>
        </div>
      </div>
    `).join('');
  },
};


// ============================================================
// DOM HELPERS
// ============================================================

const DOM = {
  /**
   * Query selector shorthand
   */
  $(sel, ctx = document) {
    return ctx.querySelector(sel);
  },

  $$(sel, ctx = document) {
    return Array.from(ctx.querySelectorAll(sel));
  },

  /**
   * Set inner HTML safely (escape user-generated strings)
   */
  setText(el, text) {
    if (!el) return;
    el.textContent = text;
  },

  setHTML(el, html) {
    if (!el) return;
    el.innerHTML = html;
  },

  /**
   * Show/hide element with display flex
   */
  show(el, displayType = 'flex') {
    if (el) {
      el.style.display = displayType;
      el.classList.remove('hidden');
    }
  },

  hide(el) {
    if (el) el.classList.add('hidden');
  },

  /**
   * Toggle active class on a set of siblings
   */
  setActive(group, active) {
    group.forEach(el => el.classList.remove('active'));
    active.classList.add('active');
  },

  /**
   * Create an element with attributes and inner HTML
   */
  create(tag, attrs = {}, innerHTML = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    });
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  /**
   * Simple HTML escaping to prevent XSS in text rendered as HTML
   */
  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Format numbers nicely
   */
  formatNumber(num) {
    if (num === null || num === undefined) return '—';
    const n = parseFloat(num);
    if (isNaN(n)) return String(num);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  },

  /**
   * Format currency
   */
  formatCurrency(num) {
    if (num === null || num === undefined) return '—';
    return '$' + parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  /**
   * Format a date string
   */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  },

  /**
   * Format execution duration in ms
   */
  formatDuration(ms) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  },

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  },

  /**
   * Trigger file download
   */
  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Convert result rows/columns to CSV string
   */
  rowsToCSV(columns, rows) {
    const header = columns.join(',');
    const body = rows.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ).join('\n');
    return header + '\n' + body;
  },
};


// ============================================================
// THEME MANAGER
// ============================================================

const ThemeManager = {
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    AppState.saveTheme(theme);

    // Update CodeMirror themes if editors exist
    const editors = window._cmEditors || [];
    editors.forEach(editor => {
      if (theme === 'dark') editor.setOption('theme', 'dracula');
      else editor.setOption('theme', 'default');
    });
  },

  toggle() {
    const current = AppState.get('theme');
    this.apply(current === 'dark' ? 'light' : 'dark');
  },

  init() {
    AppState.loadTheme();
    this.apply(AppState.get('theme'));
  },
};
