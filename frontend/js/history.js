/**
 * SchemaSay — Query History Module
 * Renders history list, search/filter, re-run action.
 */

const History = (() => {
  let _filter = 'all';
  let _search = '';

  async function render(container) {
    container.innerHTML = `
      <div class="page-view">
        <div class="page-header-row">
          <div class="page-header">
            <h1 class="page-title">Query History</h1>
            <p class="page-subtitle">Browse past queries, re-run them, or load SQL into the workbench.</p>
          </div>
        </div>

        <div class="history-filters">
          <div class="filter-chips">
            <button class="filter-chip active" data-filter="all">All</button>
            <button class="filter-chip" data-filter="success">Successful</button>
            <button class="filter-chip" data-filter="failed">Failed</button>
          </div>
          <div class="history-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="history-search-input" placeholder="Search questions or SQL..." autocomplete="off">
          </div>
        </div>

        <div id="history-list-container">
          <div style="display:flex;align-items:center;gap:12px;padding:32px;color:var(--text-muted);">
            <span class="spinner"></span> Loading history...
          </div>
        </div>
      </div>
    `;

    // Filter chips
    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        _filter = chip.dataset.filter;
        _renderList();
      });
    });

    // Search
    document.getElementById('history-search-input')?.addEventListener('input', (e) => {
      _search = e.target.value.trim().toLowerCase();
      _renderList();
    });

    await _loadHistory();
  }

  async function _loadHistory() {
    try {
      const history = await api.getQueryHistory(1, 50);
      AppState.set({ queryHistory: history });
      _renderList();
    } catch (err) {
      const c = document.getElementById('history-list-container');
      if (c) c.innerHTML = `
        <div class="state-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          Failed to load history: ${DOM.escape(err.message)}
        </div>
      `;
    }
  }

  function _renderList() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    let history = AppState.get('queryHistory') || [];

    // Filter by status
    if (_filter !== 'all') {
      history = history.filter(h => h.status === _filter);
    }

    // Filter by search text
    if (_search) {
      history = history.filter(h =>
        h.question?.toLowerCase().includes(_search) ||
        h.sql_query?.toLowerCase().includes(_search)
      );
    }

    if (history.length === 0) {
      container.innerHTML = `
        <div class="state-empty">
          <svg class="state-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p class="state-empty-title">${_search ? 'No results found' : 'No query history yet'}</p>
          <p class="state-empty-desc">${_search ? `No queries match "${DOM.escape(_search)}"` : 'Run your first query in the AI Copilot or SQL Workbench.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="history-list">${history.map(entry => `
      <div class="history-card">
        <div class="history-card-header">
          <div class="history-question">${DOM.escape(entry.question || 'Direct SQL query')}</div>
          <div class="history-actions">
            <button class="btn btn-secondary btn-sm history-view-btn" data-id="${entry.id}">View</button>
            <button class="btn btn-primary btn-sm history-rerun-btn" data-id="${entry.id}">Re-run</button>
          </div>
        </div>
        <div class="history-card-meta">
          <span class="history-meta-item">
            <span class="${entry.status === 'success' ? 'badge badge-success' : 'badge badge-error'}">${entry.status}</span>
          </span>
          <span class="history-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${DOM.formatDuration(entry.execution_duration_ms)}
          </span>
          <span class="history-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <strong>${DOM.escape(entry.connection_name || '—')}</strong>
          </span>
          <span class="history-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            ${DOM.formatDate(entry.created_at)}
          </span>
        </div>
        ${entry.sql_query ? `
          <div class="history-sql-preview" data-id="${entry.id}">
            ${DOM.escape(entry.sql_query)}
          </div>
        ` : ''}
      </div>
    `).join('')}</div>`;

    // Bind actions
    container.querySelectorAll('.history-rerun-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = history.find(h => String(h.id) === String(btn.dataset.id));
        if (entry) _rerun(entry);
      });
    });
  }

  function _rerun(entry) {
    if (entry.query_type === 'direct_sql' || entry.question === 'Manual SQL Editor Query') {
      // Load direct SQL into the workbench
      Router.navigate('workbench');
      setTimeout(() => {
        const wb = window._workbenchEditor;
        if (wb) wb.setValue(entry.sql_query || '');
      }, 300);
    } else if (entry.question) {
      // Load assistant question into AI Copilot
      Router.navigate('dashboard');
      setTimeout(() => {
        const input = document.getElementById('copilot-input');
        if (input) {
          input.value = entry.question;
          input.focus();
        }
      }, 200);
    }
  }

  return { render };
})();
