/**
 * SchemaSay — App Bootstrap
 * Initializes all modules, sets up routing, handles sidebar navigation.
 */

// ============================================================
// NAVIGATION
// ============================================================

function activateNavItem(view) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  // Toggle schema panel visibility — show on dashboard/workbench
  const schemaPanel = document.getElementById('schema-panel');
  if (schemaPanel) {
    const showSchema = ['dashboard', 'workbench'].includes(view);
    schemaPanel.classList.toggle('hidden', !showSchema);
  }
}

// ============================================================
// VIEW RENDERER
// ============================================================

function renderView(view) {
  const main = document.getElementById('main-content');
  if (!main) return;

  activateNavItem(view);

  switch (view) {
    case 'dashboard':
      _renderDashboard(main);
      break;
    case 'workbench':
      Workbench.render(main);
      break;
    case 'connections':
      Connections.render(main);
      break;
    case 'schema':
      _renderSchemaPage(main);
      break;
    case 'history':
      History.render(main);
      break;
    case 'insights':
      InsightsPage.render(main);
      break;
    case 'settings':
      Settings.render(main);
      break;
    default:
      _renderDashboard(main);
  }
}

// ============================================================
// DASHBOARD VIEW
// ============================================================

function _renderDashboard(container) {
  container.innerHTML = `
    <div id="view-dashboard">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <div>
          <div class="dashboard-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 22C12 17 11 11 4 7"/><path d="M10 14c2.5-1 5-2.5 6-5"/><path d="M9.5 18c2.5-1 5-2.5 6.5-5"/></svg>
            AI Copilot
          </div>
          <p class="dashboard-subtitle">Ask questions in natural language. Get SQL, results, charts and insights.</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="clear-chat-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          Clear Chat
        </button>
      </div>

      <!-- Dashboard Body -->
      <div class="dashboard-body">
        <!-- AI Prompt Card -->
        <div class="copilot-prompt-card">
          <div class="copilot-prompt-row">
            <div class="copilot-ai-avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"><path d="M12 2C7 2 3 6 3 11c0 5 4 9 9 9s9-4 9-9c0-3-2-7-9-9z"/><path d="M12 20c0-4-1-8-6-11"/><path d="M10 14c2-1 4-2.5 5-5"/></svg>
            </div>
            <div class="copilot-input-wrap">
              <input type="text"
                id="copilot-input"
                class="copilot-input"
                placeholder="Ask a question about your data..."
                autocomplete="off"
                aria-label="Natural language query input">
            </div>
            <button class="copilot-send-btn" id="copilot-send-btn" aria-label="Send query">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div class="suggestion-chips">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <button class="suggestion-chip" data-prompt="Top customers by revenue this month">Top customers by revenue this month</button>
            <button class="suggestion-chip" data-prompt="Monthly sales trend for last 6 months">Monthly sales trend for last 6 months</button>
            <button class="suggestion-chip" data-prompt="Products with low stock">Products with low stock</button>
          </div>
        </div>

        <!-- Processing Panel (hidden until query starts) -->
        <div id="copilot-processing" style="display:none;">
          <div class="processing-panel">
            <div class="processing-header">
              <span class="spinner sm"></span>
              Processing your query...
            </div>
            <div class="processing-stages"></div>
            <div class="processing-meta" style="display:none;"></div>
          </div>
        </div>

        <!-- Generated SQL Panel (hidden until query completes) -->
        <div class="sql-panel" id="copilot-sql-panel" style="display:none;">
          <div class="sql-panel-header">
            <span class="sql-panel-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Generated SQL
            </span>
            <div class="sql-panel-actions">
              <span id="sql-valid-badge" class="sql-valid-badge" style="display:none;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Valid SQL
              </span>
              <button class="btn btn-secondary btn-sm" id="format-sql-btn">Format SQL</button>
              <button class="btn btn-primary btn-sm" id="run-query-btn" style="display:flex;align-items:center;gap:6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run Query
              </button>
              <button class="btn btn-icon sm" id="copy-sql-btn" title="Copy SQL" aria-label="Copy SQL to clipboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          <div class="sql-editor-wrap">
            <textarea id="generated-sql-editor"></textarea>
          </div>
        </div>

        <!-- Results Workspace (hidden until query completes) -->
        <div id="copilot-results-wrap" class="results-workspace" style="display:none;"></div>

        <!-- AI Insights Bar (hidden until results are ready) -->
        <div class="insights-bar" id="insights-bar" style="display:none;">
          <div class="insights-bar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 16v-4M12 8h.01"/></svg>
            AI Insights
          </div>
          <p class="insights-bar-text" id="insights-bar-text">Generating insights...</p>
          <button class="btn btn-ghost btn-sm" id="insights-bar-regen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Regenerate
          </button>
        </div>
      </div>
    </div>
  `;

  // Initialize Copilot module (binds events, creates CodeMirror)
  Copilot.init();

  // Clear chat
  document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    document.getElementById('copilot-processing').style.display = 'none';
    document.getElementById('copilot-sql-panel').style.display = 'none';
    document.getElementById('copilot-results-wrap').style.display = 'none';
    document.getElementById('insights-bar').style.display = 'none';
    document.getElementById('copilot-input').value = '';
    AppState.set({ queryResult: null, currentQuery: null });
    Toast.info('Chat cleared.');
  });
}


// ============================================================
// SCHEMA PAGE VIEW (standalone schema explorer in main area)
// ============================================================

function _renderSchemaPage(container) {
  const conn = AppState.get('activeConnection');
  const schema = AppState.get('schema');
  const tables = Object.entries(schema).map(([name, columns]) => ({ name, columns }));

  container.innerHTML = `
    <div class="page-view">
      <div class="page-header-row">
        <div class="page-header">
          <h1 class="page-title">Schema Explorer</h1>
          <p class="page-subtitle">Browse tables, columns, and data types for <strong>${DOM.escape(conn?.name || 'your database')}</strong>.</p>
        </div>
        <button class="btn btn-primary" id="schema-page-sync-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Sync Schema
        </button>
      </div>

      ${tables.length === 0 ? `
        <div class="state-empty">
          <svg class="state-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <p class="state-empty-title">No schema loaded</p>
          <p class="state-empty-desc">Select a connection and click "Sync Schema" to load table definitions.</p>
        </div>
      ` : `
        <div class="grid-2" style="gap:24px;">
          <!-- Tables list -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Tables <span class="badge-count">${tables.length}</span></span>
            </div>
            <div style="padding:8px;">
              ${tables.map(t => `
                <div class="schema-table-item" data-table="${DOM.escape(t.name)}" id="sp-table-${DOM.escape(t.name)}" style="cursor:pointer;">
                  <svg class="schema-table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  <span class="schema-table-name">${DOM.escape(t.name)}</span>
                  <span class="schema-table-count">${t.columns.length}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Column inspector -->
          <div class="card" id="sp-column-card">
            <div class="card-header">
              <span class="card-title" id="sp-col-title">Select a table</span>
            </div>
            <div id="sp-col-body" style="padding:8px;">
              <div class="state-empty" style="padding:32px 16px;">
                <p class="state-empty-desc">Click a table on the left to inspect its columns.</p>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;

  // Table selection
  tables.forEach(t => {
    document.getElementById(`sp-table-${t.name}`)?.addEventListener('click', () => {
      document.querySelectorAll('.schema-table-item').forEach(el => el.classList.remove('selected'));
      document.getElementById(`sp-table-${t.name}`)?.classList.add('selected');

      const titleEl = document.getElementById('sp-col-title');
      if (titleEl) titleEl.textContent = `Columns (${t.name})`;

      const bodyEl = document.getElementById('sp-col-body');
      if (bodyEl) {
        bodyEl.innerHTML = t.columns.map(col => {
          const pk = col.pk ? `<span class="badge badge-pk">PK</span>` : '';
          const fk = col.fk ? `<span class="badge badge-fk">FK</span>` : '';
          return `
            <div class="column-row">
              <span class="column-name">${DOM.escape(col.name)}</span>
              <span class="column-type">${DOM.escape(col.type)}</span>
              <span class="column-badges">${pk}${fk}</span>
            </div>
          `;
        }).join('');
      }
    });
  });

  // Sync button
  document.getElementById('schema-page-sync-btn')?.addEventListener('click', async () => {
    const connObj = AppState.get('activeConnection');
    if (!connObj) { Toast.warning('No active connection.'); return; }
    const btn = document.getElementById('schema-page-sync-btn');
    Loading.setButton(btn, 'Syncing...');
    try {
      await api.syncSchema(connObj.id);
      await SchemaModule.loadSchema(connObj.id);
      _renderSchemaPage(container);
      Toast.success('Schema synchronized.');
    } catch (err) {
      Toast.error('Sync failed: ' + err.message);
      Loading.resetButton(btn);
    }
  });
}


// ============================================================
// TOPBAR SETUP
// ============================================================

function initTopbar() {
  // Connection selector dropdown
  const connSelector = document.getElementById('conn-selector-trigger');
  connSelector?.addEventListener('click', () => {
    Dropdown.toggle('conn-selector-trigger', 'conn-dropdown-menu');
  });

  // Header nav buttons
  document.getElementById('header-copilot-btn')?.addEventListener('click', () => Router.navigate('dashboard'));
  document.getElementById('header-workbench-btn')?.addEventListener('click', () => Router.navigate('workbench'));

  // User menu
  document.getElementById('user-menu-trigger')?.addEventListener('click', () => {
    Dropdown.toggle('user-menu-trigger', 'user-dropdown-menu');
  });

  // User dropdown items
  document.getElementById('user-menu-settings')?.addEventListener('click', () => {
    Dropdown.close('user-dropdown-menu');
    Router.navigate('settings');
  });

  document.getElementById('user-menu-logout')?.addEventListener('click', () => {
    Dropdown.close('user-dropdown-menu');
    Auth.logout();
  });
}


// ============================================================
// SIDEBAR SETUP
// ============================================================

function initSidebar() {
  // Nav items
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => Router.navigate(item.dataset.view));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Router.navigate(item.dataset.view);
    });
  });

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', () => {
    ThemeManager.toggle();
    const isDark = AppState.get('theme') === 'dark';
    themeToggle.classList.toggle('active', isDark);

    // Update Charts
    setTimeout(() => Charts.refreshTheme(), 100);
  });

  // Mobile hamburger
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('mobile-open');
    overlay?.classList.toggle('active');
  });

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('active');
  });

  // Schema refresh (right panel)
  document.getElementById('schema-refresh-btn')?.addEventListener('click', () => {
    const conn = AppState.get('activeConnection');
    if (conn) SchemaModule.loadSchema(conn.id);
  });
}


// ============================================================
// ROUTER SETUP
// ============================================================

function initRouter() {
  Router
    .on('dashboard',    () => renderView('dashboard'))
    .on('workbench',    () => renderView('workbench'))
    .on('connections',  () => renderView('connections'))
    .on('schema',       () => renderView('schema'))
    .on('history',      () => renderView('history'))
    .on('insights',     () => renderView('insights'))
    .on('settings',     () => renderView('settings'));
}


// ============================================================
// APP BOOTSTRAP
// ============================================================

async function bootstrapApp() {
  // Apply saved theme
  ThemeManager.init();

  // Set initial theme toggle state
  const isDark = AppState.get('theme') === 'dark';
  document.getElementById('theme-toggle')?.classList.toggle('active', isDark);

  // Init modals
  Connections.initAddConnectionModal();
  Connections.initUploadModal();

  // Init sidebar and topbar
  initSidebar();
  initTopbar();

  // Init router
  initRouter();

  // Check session / authenticate
  const isLoggedIn = await Auth.checkSession();

  if (isLoggedIn) {
    // Load connections
    await Connections.loadConnections();

    // Init schema panel
    SchemaModule.init();

    // Start routing
    Router.start();
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', bootstrapApp);
