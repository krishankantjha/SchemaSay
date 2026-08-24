/**
 * SchemaSay — Data Insights & Settings Module
 */

const InsightsPage = (() => {

  async function _renderLive(container, renderToken) {
    const isCurrentView = () => container.__viewRenderToken === renderToken;
    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <h1 class="page-title">Data Insights</h1>
          <p class="page-subtitle">A live view of your SchemaSay query activity.</p>
        </div>
        <div class="state-loading" style="padding:32px;">
          <span class="spinner"></span>
          <span>Loading query activity...</span>
        </div>
      </div>`;

    try {
      const history = await api.getQueryHistory(1, 50);
      if (!isCurrentView()) return;
      const entries = Array.isArray(history) ? history : [];
      const successful = entries.filter(entry => entry.status === 'success');
      const failed = entries.filter(entry => entry.status === 'failed');
      const durations = entries.map(entry => Number(entry.execution_duration_ms)).filter(Number.isFinite);
      const averageDuration = durations.length
        ? durations.reduce((total, value) => total + value, 0) / durations.length
        : 0;
      const dailyCounts = {};
      entries.forEach(entry => {
        const day = entry.created_at ? new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown';
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });
      const activityLabels = Object.keys(dailyCounts).slice(-14);
      const activityValues = activityLabels.map(day => dailyCounts[day]);

      if (entries.length === 0) {
        container.innerHTML = `
          <div class="page-view">
            <div class="page-header">
              <h1 class="page-title">Data Insights</h1>
              <p class="page-subtitle">A live view of your SchemaSay query activity.</p>
            </div>
            <div class="state-empty">
              <svg class="state-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3"/></svg>
              <p class="state-empty-title">No query activity yet</p>
              <p class="state-empty-desc">Run a query in Copilot or SQL Workbench to start building your live activity summary.</p>
              <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
                <button class="btn btn-primary btn-sm" data-insights-route="dashboard">Open Copilot</button>
                <button class="btn btn-secondary btn-sm" data-insights-route="workbench">Open Workbench</button>
              </div>
            </div>
          </div>`;
        container.querySelectorAll('[data-insights-route]').forEach(button => {
          button.addEventListener('click', () => Router.navigate(button.dataset.insightsRoute));
        });
        return;
      }

      container.innerHTML = `
        <div class="page-view">
          <div class="page-header">
            <h1 class="page-title">Data Insights</h1>
            <p class="page-subtitle">A live view of your SchemaSay query activity.</p>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Total Queries</div><div class="kpi-value">${DOM.formatNumber(entries.length)}</div><div class="kpi-change">Loaded from query history</div></div>
            <div class="kpi-card"><div class="kpi-label">Successful</div><div class="kpi-value">${DOM.formatNumber(successful.length)}</div><div class="kpi-change positive">${Math.round((successful.length / entries.length) * 100)}% success rate</div></div>
            <div class="kpi-card"><div class="kpi-label">Failed</div><div class="kpi-value">${DOM.formatNumber(failed.length)}</div><div class="kpi-change ${failed.length ? 'negative' : 'positive'}">${failed.length ? 'Needs attention' : 'No failures recorded'}</div></div>
            <div class="kpi-card"><div class="kpi-label">Average Duration</div><div class="kpi-value">${DOM.formatDuration(averageDuration)}</div><div class="kpi-change">Across loaded queries</div></div>
          </div>
          <div class="insights-charts-grid">
            <div class="insights-chart-card">
              <div class="insights-chart-header"><div class="insights-chart-title">Query Activity</div></div>
              <div class="insights-chart-body"><canvas id="insights-activity-chart" aria-label="Query activity over time"></canvas></div>
            </div>
            <div class="insights-chart-card">
              <div class="insights-chart-header"><div class="insights-chart-title">Query Outcomes</div></div>
              <div class="insights-chart-body"><canvas id="insights-outcome-chart" aria-label="Successful and failed queries"></canvas></div>
            </div>
          </div>
          <div class="card" style="margin-top:24px;">
            <div class="card-header"><span class="card-title">Recent activity</span><button class="btn btn-ghost btn-sm" data-insights-route="history">View history</button></div>
            <div class="card-body" style="padding:0;">
              ${entries.slice(0, 5).map(entry => `
                <div class="activity-row">
                  <span class="activity-status ${entry.status === 'success' ? 'success' : 'failed'}"></span>
                  <span class="activity-question">${DOM.escape(entry.question || 'Direct SQL query')}</span>
                  <span class="activity-meta">${DOM.escape(entry.connection_name || '—')} · ${DOM.formatDate(entry.created_at)}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      Charts.render('insights-activity-chart', 'line', activityLabels, activityValues, 'Queries', 'Query Activity');
      Charts.render('insights-outcome-chart', 'doughnut', ['Successful', 'Failed'], [successful.length, failed.length], 'Queries', 'Query Outcomes');
      container.querySelectorAll('[data-insights-route]').forEach(button => {
        button.addEventListener('click', () => Router.navigate(button.dataset.insightsRoute));
      });
    } catch (err) {
      if (!isCurrentView()) return;
      container.innerHTML = `
        <div class="page-view">
          <div class="page-header"><h1 class="page-title">Data Insights</h1><p class="page-subtitle">A live view of your SchemaSay query activity.</p></div>
          <div class="state-error" role="alert">Unable to load query activity. ${DOM.escape(err.message)}</div>
        </div>`;
    }
  }

  function render(container, renderToken) {
    if (!DEMO_MODE) {
      _renderLive(container, renderToken);
      return;
    }
    const kpis = DEMO.kpis;
    const revenueData = DEMO.revenueData;
    const regionData  = DEMO.regionData;

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <h1 class="page-title">Data Insights</h1>
          <p class="page-subtitle">Analytics overview of your connected database.</p>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Total Revenue
            </div>
            <div class="kpi-value">${kpis.totalRevenue}</div>
            <div class="kpi-change positive">↑ ${kpis.revenueChange} vs last month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Total Orders
            </div>
            <div class="kpi-value">${kpis.totalOrders}</div>
            <div class="kpi-change positive">↑ ${kpis.ordersChange} vs last month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Avg Order Value
            </div>
            <div class="kpi-value">${kpis.avgOrderValue}</div>
            <div class="kpi-change positive">↑ ${kpis.aovChange} vs last month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Top Product
            </div>
            <div class="kpi-value" style="font-size:var(--text-xl);">${kpis.topProduct}</div>
            <div class="kpi-change positive">↑ $125.4K this month</div>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="insights-charts-grid">
          <div class="insights-chart-card">
            <div class="insights-chart-header">
              <div class="insights-chart-title">Monthly Revenue Trend</div>
            </div>
            <div class="insights-chart-body">
              <canvas id="insights-revenue-chart"></canvas>
            </div>
          </div>
          <div class="insights-chart-card">
            <div class="insights-chart-header">
              <div class="insights-chart-title">Sales by Region</div>
            </div>
            <div class="insights-chart-body">
              <canvas id="insights-region-chart"></canvas>
            </div>
          </div>
          <div class="insights-chart-card">
            <div class="insights-chart-header">
              <div class="insights-chart-title">Top Products by Revenue</div>
            </div>
            <div class="insights-chart-body">
              <canvas id="insights-products-chart"></canvas>
            </div>
          </div>
          <div class="insights-chart-card">
            <div class="insights-chart-header">
              <div class="insights-chart-title">Inventory Alert — Low Stock</div>
            </div>
            <div class="insights-chart-body">
              <canvas id="insights-stock-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render charts after DOM is available
    setTimeout(() => {
      Charts.render('insights-revenue-chart', 'line',
        revenueData.labels, revenueData.values, 'Revenue ($)', 'Monthly Revenue'
      );
      Charts.render('insights-region-chart', 'doughnut',
        regionData.labels, regionData.values, 'Sales', 'Sales by Region'
      );
      Charts.render('insights-products-chart', 'bar',
        ['Earbuds', 'Watch', 'Keyboard', 'Mouse', 'Monitor'],
        [125430, 98765, 75310, 62145, 54890],
        'Revenue ($)', 'Top Products'
      );
      Charts.render('insights-stock-chart', 'bar',
        ['Headphones', 'Tablet', 'Camera', 'Speaker', 'Drone'],
        [12, 18, 23, 31, 42],
        'Units in Stock', 'Low Stock Items'
      );
    }, 100);
  }

  return { render };
})();


// ============================================================
// SQL WORKBENCH MODULE
// ============================================================

const Workbench = (() => {
  let _editor = null;

  function _buildStarterSQL() {
    const schema = AppState.get('schema') || {};
    const tableName = Object.keys(schema)[0];
    if (!tableName) return '-- Select a connection and synchronize its schema before writing a query.';

    const safeName = /^[A-Za-z_][A-Za-z0-9_$]*$/.test(tableName)
      ? tableName
      : `"${tableName.replace(/"/g, '""')}"`;
    return `SELECT * FROM ${safeName} LIMIT 10;`;
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-view workbench-layout">
        <div class="page-header">
          <h1 class="page-title">SQL Workbench</h1>
          <p class="page-subtitle">Write, run, and format raw SQL against your active connection.</p>
        </div>

        <div class="workbench-editor-card">
          <div class="workbench-editor-header">
            <span class="workbench-editor-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/></svg>
              SQL Editor
            </span>
            <div class="workbench-editor-actions">
              <button class="btn btn-secondary btn-sm" id="wb-format-btn">Format SQL</button>
              <button class="btn btn-ghost btn-sm" id="wb-copy-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
              <button class="btn btn-ghost btn-sm" id="wb-clear-btn">Clear</button>
            </div>
          </div>

          <div class="workbench-CodeMirror">
            <textarea id="workbench-sql-editor">${DOM.escape(_buildStarterSQL())}</textarea>
          </div>

          <div class="workbench-footer">
            <span class="workbench-status-text" id="wb-status">
              Press Ctrl + Enter to run query
            </span>
            <button class="workbench-run-btn" id="wb-run-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Run Query
            </button>
          </div>
        </div>

        <div id="wb-results-container" style="display:none;"></div>
      </div>
    `;

    // Init CodeMirror
    const el = document.getElementById('workbench-sql-editor');
    if (el && window.CodeMirror) {
      const isDark = AppState.get('theme') === 'dark';
      _editor = CodeMirror.fromTextArea(el, {
        mode: 'text/x-sql',
        theme: isDark ? 'dracula' : 'default',
        lineNumbers: true,
        indentWithTabs: false,
        smartIndent: true,
        lineWrapping: false,
        styleActiveLine: true,
        extraKeys: {
          'Ctrl-Enter':  () => _runSQL(),
          'Cmd-Enter':   () => _runSQL(),
          'Tab': cm => cm.replaceSelection('  '),
        },
      });
      _editor.setSize('100%', '240px');
      window._workbenchEditor = _editor;

      // Register for theme updates
      if (!window._cmEditors) window._cmEditors = [];
      if (!window._cmEditors.includes(_editor)) window._cmEditors.push(_editor);
    }

    // Button handlers
    document.getElementById('wb-run-btn')?.addEventListener('click', _runSQL);
    document.getElementById('wb-format-btn')?.addEventListener('click', _formatSQL);
    document.getElementById('wb-copy-btn')?.addEventListener('click', _copySQL);
    document.getElementById('wb-clear-btn')?.addEventListener('click', () => {
      _editor?.setValue('');
      _editor?.focus();
    });
  }

  async function _runSQL() {
    if (!_editor) return;
    const sql = _editor.getValue().trim();
    if (!sql) { Toast.warning('Please enter a SQL query.'); return; }

    const conn = AppState.get('activeConnection');
    if (!conn) { Toast.warning('Please select a database connection first.'); return; }

    const btn  = document.getElementById('wb-run-btn');
    const statusEl = document.getElementById('wb-status');
    const resultsContainer = document.getElementById('wb-results-container');

    Loading.setButton(btn, 'Running...');
    if (statusEl) { statusEl.className = 'workbench-status-text'; statusEl.textContent = 'Executing query...'; }
    AppState.set({ isExecuting: true });

    try {
      const data = await api.executeQuery(conn.id, sql);
      const results = api.toQueryResult(data);

      AppState.set({ queryResult: results, currentSql: sql, currentQuery: 'Manual SQL Editor Query' });

      if (resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `<div class="results-workspace"></div>`;
        QueryResults.render(results, resultsContainer.querySelector('.results-workspace'));
      }

      if (statusEl) {
        statusEl.className = 'workbench-status-text success';
        statusEl.innerHTML = `✓ Query executed — ${results.rowCount} row(s) in ${DOM.formatDuration(data.execution_time_ms)}${results.truncated ? ' · result set limited' : ''}`;
      }
      Toast.success(`Query executed — ${results.rowCount} row(s) returned${results.truncated ? ' (limited)' : ''}.`);

    } catch (err) {
      if (statusEl) {
        statusEl.className = 'workbench-status-text error';
        statusEl.textContent = '× ' + err.message;
      }
      if (resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
          <div class="state-error" style="margin-top:16px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <div>
              <strong>Query execution failed</strong>
              <div style="margin-top:4px;font-size:var(--text-xs);">${DOM.escape(err.message)}</div>
            </div>
          </div>
        `;
      }
      Toast.error(`Query failed: ${err.message}`);
    } finally {
      Loading.resetButton(btn);
      AppState.set({ isExecuting: false });
    }
  }

  async function _formatSQL() {
    if (!_editor) return;
    const sql = _editor.getValue();
    if (!sql.trim()) return;
    const btn = document.getElementById('wb-format-btn');
    Loading.setButton(btn, 'Formatting...');
    try {
      const data = await api.formatQuery(sql);
      _editor.setValue(data.formatted_sql || sql);
      Toast.success('SQL formatted.');
    } catch (err) {
      Toast.error('Format failed: ' + err.message);
    } finally {
      Loading.resetButton(btn);
    }
  }

  async function _copySQL() {
    if (!_editor) return;
    const ok = await DOM.copyToClipboard(_editor.getValue());
    if (ok) Toast.success('SQL copied to clipboard.');
    else    Toast.error('Could not copy to clipboard.');
  }

  function getEditor() { return _editor; }

  return { render, getEditor };
})();


// ============================================================
// SETTINGS MODULE
// ============================================================

const Settings = (() => {
  function render(container) {
    const user = AppState.get('user') || {};
    const initials = user.full_name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '??';

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Manage your account, preferences, and API keys.</p>
        </div>

        <!-- Profile -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Profile</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-row">
              <div style="display:flex;align-items:center;gap:16px;">
                <div class="user-avatar lg">${initials}</div>
                <div class="settings-row-info">
                  <div class="settings-row-label">${DOM.escape(user.full_name || 'User')}</div>
                  <div class="settings-row-desc">${DOM.escape(user.email || 'Not logged in')}</div>
                </div>
              </div>
              <span class="settings-readonly">Account details are managed securely</span>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Appearance</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Theme</div>
                <div class="settings-row-desc">Switch between light and dark mode.</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm ${AppState.get('theme') === 'light' ? 'btn-primary' : ''}" id="set-theme-light">Light</button>
                <button class="btn btn-secondary btn-sm ${AppState.get('theme') === 'dark' ? 'btn-primary' : ''}" id="set-theme-dark">Dark</button>
              </div>
            </div>
          </div>
        </div>

        <!-- API Keys -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">AI Engine</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">LLM Provider</div>
                <div class="settings-row-desc">Configure which AI model generates your SQL.</div>
              </div>
              <span class="settings-readonly">Managed by server configuration</span>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Gemini API Key</div>
                <div class="settings-row-desc">Set in the .env file on the backend server.</div>
              </div>
              <span class="settings-readonly">API keys are never stored in the browser</span>
            </div>
          </div>
        </div>

        <!-- Account Actions -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Account</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Sign Out</div>
                <div class="settings-row-desc">Sign out of your SchemaSay session.</div>
              </div>
              <button class="btn btn-danger btn-sm" id="settings-logout-btn">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('set-theme-light')?.addEventListener('click', () => {
      ThemeManager.apply('light');
      render(container); // Re-render to update button styles
    });

    document.getElementById('set-theme-dark')?.addEventListener('click', () => {
      ThemeManager.apply('dark');
      render(container);
    });

    document.getElementById('settings-logout-btn')?.addEventListener('click', Auth.logout);
  }

  return { render };
})();
