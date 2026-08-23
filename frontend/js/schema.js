/**
 * SchemaSay — Schema Explorer Module
 * Renders schema tree, column inspector, search filter, sync.
 */

const SchemaModule = (() => {
  let _searchInput = null;
  let _tablesList  = null;
  let _colInspector = null;
  let _syncBtn = null;
  let _loadSequence = 0;

  // ---- Init ----

  function init() {
    _searchInput  = document.getElementById('schema-search-input');
    _tablesList   = document.getElementById('schema-tables-list');
    _colInspector = document.getElementById('column-inspector');
    _syncBtn      = document.getElementById('schema-refresh-btn') || document.getElementById('sync-schema-btn');

    _searchInput?.addEventListener('input', _filterTables);
    _syncBtn?.addEventListener('click', _syncSchema);
    _updateConnectionLabel(AppState.get('activeConnection'));

    // Load schema for active connection or show a useful empty state.
    const connId = AppState.get('activeConnection')?.id;
    if (connId) loadSchema(connId);
    else _renderTables([]);

    // React to connection changes
    AppState.subscribe('activeConnection', (conn) => {
      _updateConnectionLabel(conn);
      if (conn?.id) loadSchema(conn.id);
      else loadSchema(null);
    });
  }

  function _updateConnectionLabel(connection) {
    const label = document.getElementById('schema-name');
    if (label) label.textContent = connection?.name || 'No connection selected';
  }

  // ---- Load Schema ----

  async function loadSchema(connectionId) {
    if (!connectionId) {
      if (_searchInput) _searchInput.value = '';
      AppState.set({ schema: {}, selectedTable: null, isLoadingSchema: false });
      _renderTables([]);
      if (_colInspector) _colInspector.classList.add('hidden');
      return;
    }

    const requestSequence = ++_loadSequence;
    if (_searchInput) _searchInput.value = '';
    AppState.set({ isLoadingSchema: true });
    Loading.showSkeleton(_tablesList, 8);
    if (_colInspector) _colInspector.classList.add('hidden');

    try {
      const data = await api.getSchema(connectionId);
      if (requestSequence !== _loadSequence) return;
      const tables = Array.isArray(data?.tables) ? data.tables : [];

      AppState.set({ schema: _indexSchema(tables), selectedTable: null });
      _renderTables(tables);

      // Auto-select the first table only when real schema data is available.
      if (tables.length > 0) _selectTable(tables[0].name);

    } catch (err) {
      if (requestSequence !== _loadSequence) return;
      if (_tablesList) {
        _tablesList.innerHTML = `
          <div class="state-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Failed to load schema. ${DOM.escape(err.message)}</span>
          </div>
        `;
      }
    } finally {
      if (requestSequence === _loadSequence) AppState.set({ isLoadingSchema: false });
    }
  }

  function _indexSchema(tables) {
    const idx = Object.create(null);
    tables.forEach(t => {
      if (t?.name) idx[t.name] = Array.isArray(t.columns) ? t.columns : [];
    });
    return idx;
  }

  // ---- Render Tables ----

  function _renderTables(tables, filterText = '') {
    if (!_tablesList) return;

    const filtered = filterText
      ? tables.filter(t =>
          t.name.toLowerCase().includes(filterText.toLowerCase()) ||
          (t.columns || []).some(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
        )
      : tables;

    if (filtered.length === 0) {
      const hasFilter = Boolean(filterText);
      _tablesList.innerHTML = `
        <div class="state-empty" style="padding:var(--sp-6) var(--sp-4)">
          <svg class="state-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <p class="state-empty-title">${hasFilter ? 'No matching tables' : 'No schema loaded'}</p>
          <p class="state-empty-desc">${hasFilter ? `Nothing matches "${DOM.escape(filterText)}".` : 'Select a connection and synchronize its schema to see tables here.'}</p>
        </div>
      `;
      return;
    }

    _tablesList.innerHTML = filtered.map(table => `
      <div class="schema-table-item" data-table="${DOM.escape(table.name)}" role="button" tabindex="0" aria-label="Select table ${DOM.escape(table.name)}">
        <svg class="schema-table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <span class="schema-table-name">${DOM.escape(table.name)}</span>
        <span class="schema-table-count">${(table.columns || []).length}</span>
      </div>
    `).join('');

    // Bind click/keyboard events
    _tablesList.querySelectorAll('.schema-table-item').forEach(item => {
      item.addEventListener('click', () => _selectTable(item.dataset.table));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') _selectTable(item.dataset.table);
      });
    });

    // Re-highlight selected table if any
    const selected = AppState.get('selectedTable');
    if (selected) _highlightTable(selected);
  }

  function _filterTables() {
    const text = _searchInput?.value?.trim() || '';
    const schema = AppState.get('schema');
    const tables = Object.entries(schema).map(([name, columns]) => ({ name, columns }));
    _renderTables(tables, text);
  }

  // ---- Select Table ----

  function _selectTable(tableName) {
    AppState.set({ selectedTable: tableName });
    _highlightTable(tableName);
    _renderColumnInspector(tableName);
  }

  function _highlightTable(tableName) {
    _tablesList?.querySelectorAll('.schema-table-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.table === tableName);
    });
  }

  // ---- Column Inspector ----

  function _renderColumnInspector(tableName) {
    if (!_colInspector) return;
    const schema = AppState.get('schema');
    const columns = schema[tableName] || [];

    _colInspector.classList.remove('hidden');

    const header = _colInspector.querySelector('.column-inspector-title');
    if (header) {
      header.innerHTML = `Columns <span class="column-inspector-table-name">(${DOM.escape(tableName)})</span>`;
    }

    const list = _colInspector.querySelector('.column-list');
    if (!list) return;

    if (columns.length === 0) {
      list.innerHTML = `<div class="state-empty" style="padding:16px 20px"><p class="state-empty-desc">No columns found.</p></div>`;
      return;
    }

    list.innerHTML = columns.map(col => {
      const typeIcon = _getTypeIcon(col.type);
      const pkBadge = col.pk ? `<span class="badge badge-pk">PK</span>` : '';
      const fkBadge = col.fk ? `<span class="badge badge-fk">FK</span>` : '';
      return `
        <div class="column-row">
          <span class="column-type-icon">${typeIcon}</span>
          <span class="column-name">${DOM.escape(col.name)}</span>
          <span class="column-type">${DOM.escape(col.type)}</span>
          <span class="column-badges">${pkBadge}${fkBadge}</span>
        </div>
      `;
    }).join('');
  }

  function _getTypeIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('int') || t.includes('serial') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>`;
    }
    if (t.includes('bool')) {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>`;
    }
    if (t.includes('date') || t.includes('time') || t.includes('timestamp')) {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
    }
    // Default: text/varchar
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 10h16M4 14h10"/></svg>`;
  }

  // ---- Sync Schema ----

  async function _syncSchema() {
    const conn = AppState.get('activeConnection');
    if (!conn) {
      Toast.warning('No active connection selected.');
      return;
    }

    const btn = _syncBtn;
    Loading.setButton(btn, 'Syncing...');
    AppState.set({ isSyncingSchema: true });

    // Animate refresh icon
    const refreshIcon = document.getElementById('schema-refresh-btn');
    if (refreshIcon) refreshIcon.classList.add('spinning');

    try {
      const result = await api.syncSchema(conn.id);
      await loadSchema(conn.id);
      const columnsSynced = Number(result?.columns_synced);
      const suffix = Number.isFinite(columnsSynced) ? ` ${columnsSynced} columns indexed.` : '';
      Toast.success(`Schema synchronized successfully.${suffix}`);
    } catch (err) {
      Toast.error(`Schema sync failed: ${err.message}`);
    } finally {
      Loading.resetButton(btn);
      AppState.set({ isSyncingSchema: false });
      if (refreshIcon) refreshIcon.classList.remove('spinning');
    }
  }

  return {
    init,
    loadSchema,
    refresh: _filterTables,
  };
})();
