/**
 * SchemaSay — Connections Manager Module
 * Renders connection list, add/edit modal, test connection, delete.
 */

const Connections = (() => {
  // ---- Render Connections View ----

  async function render(container) {
    container.innerHTML = `
      <div class="page-view" id="connections-page">
        <div class="page-header-row">
          <div class="page-header">
            <h1 class="page-title">Connections</h1>
            <p class="page-subtitle">Manage your database connections and file uploads.</p>
          </div>
          <div style="display:flex;gap:12px;">
            <button class="btn btn-secondary" id="upload-file-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload File
            </button>
            <button class="btn btn-primary" id="add-connection-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Connection
            </button>
          </div>
        </div>
        <div id="connection-cards-list">
          <div style="display:flex;align-items:center;gap:12px;padding:32px;color:var(--text-muted);">
            <span class="spinner"></span> Loading connections...
          </div>
        </div>
      </div>
    `;

    // Bind buttons
    document.getElementById('add-connection-btn')?.addEventListener('click', () => Modal.open('add-connection-modal'));
    document.getElementById('upload-file-btn')?.addEventListener('click', () => Modal.open('upload-file-modal'));

    await _loadConnections();
  }

  async function _loadConnections() {
    const listEl = document.getElementById('connection-cards-list');
    if (!listEl) return;

    try {
      const connections = await api.getConnections();
      AppState.set({ connections });
      _renderCards(connections, listEl);
      _updateConnectionDropdown(connections);
    } catch (err) {
      listEl.innerHTML = `
        <div class="state-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
          Failed to load connections: ${DOM.escape(err.message)}
        </div>
      `;
    }
  }

  function _renderCards(connections, container) {
    if (!connections || connections.length === 0) {
      container.innerHTML = `
        <div class="state-empty">
          <svg class="state-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <p class="state-empty-title">No connections yet</p>
          <p class="state-empty-desc">Add a database connection or upload a spreadsheet to get started.</p>
        </div>
      `;
      return;
    }

    const dbTypeLabels = { postgresql: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite', mssql: 'SQL Server' };

    container.innerHTML = `<div class="connection-cards">${connections.map(conn => `
      <div class="connection-card" data-id="${conn.id}">
        <div class="connection-card-header">
          <div class="connection-db-icon">${_getDbIcon(conn.db_type)}</div>
          <div class="connection-card-info">
            <div class="connection-card-name">${DOM.escape(conn.name)}</div>
            <div class="connection-card-type">${dbTypeLabels[conn.db_type] || conn.db_type}</div>
          </div>
          <span class="connection-status-badge ${conn.connected ? 'connected' : 'disconnected'}">
            <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>
            ${conn.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div class="connection-card-details">
          <div class="connection-detail-item">
            <span class="connection-detail-label">Host</span>
            <span class="connection-detail-value">${DOM.escape(conn.host || 'local')}</span>
          </div>
          <div class="connection-detail-item">
            <span class="connection-detail-label">Database</span>
            <span class="connection-detail-value">${DOM.escape(conn.database_name)}</span>
          </div>
          <div class="connection-detail-item">
            <span class="connection-detail-label">Port</span>
            <span class="connection-detail-value">${conn.port || '—'}</span>
          </div>
          <div class="connection-detail-item">
            <span class="connection-detail-label">Username</span>
            <span class="connection-detail-value">${DOM.escape(conn.username || '—')}</span>
          </div>
        </div>

        <div class="connection-card-actions">
          <button class="btn btn-primary btn-sm conn-activate-btn" data-id="${conn.id}">
            ${conn.connected ? 'Use Connection' : 'Connect'}
          </button>
          <button class="btn btn-secondary btn-sm conn-test-btn" data-id="${conn.id}">Test</button>
          <button class="btn btn-ghost btn-sm conn-delete-btn" data-id="${conn.id}" style="color:var(--error);margin-left:auto;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>
        </div>
      </div>
    `).join('')}</div>`;

    // Bind actions
    container.querySelectorAll('.conn-activate-btn').forEach(btn => {
      btn.addEventListener('click', () => _setActive(parseInt(btn.dataset.id)));
    });
    container.querySelectorAll('.conn-test-btn').forEach(btn => {
      btn.addEventListener('click', (e) => _testConnection(parseInt(btn.dataset.id), btn));
    });
    container.querySelectorAll('.conn-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => _deleteConnection(parseInt(btn.dataset.id), btn));
    });
  }

  function _setActive(connectionId) {
    const connections = AppState.get('connections');
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;

    AppState.set({ activeConnection: conn });

    // Update topbar
    _updateConnectionDropdown(connections, conn);

    Toast.success(`Connected to ${conn.name}`);
    SchemaModule.loadSchema(conn.id);
    Router.navigate('dashboard');
  }

  async function _testConnection(connectionId, btn) {
    const connections = AppState.get('connections');
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;

    Loading.setButton(btn, 'Testing...');

    try {
      const result = await api.testConnection({
        db_type: conn.db_type,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: '***',
        database_name: conn.database_name,
      });
      Toast.success(result.message || 'Connection test successful!');
    } catch (err) {
      Toast.error('Connection test failed: ' + err.message);
    } finally {
      Loading.resetButton(btn);
    }
  }

  async function _deleteConnection(connectionId, btn) {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    Loading.setButton(btn, 'Deleting...');
    try {
      await api.deleteConnection(connectionId);
      Toast.success('Connection deleted.');
      await _loadConnections();
    } catch (err) {
      Toast.error('Delete failed: ' + err.message);
      Loading.resetButton(btn);
    }
  }

  // ---- Connection Dropdown (Topbar) ----

  function _updateConnectionDropdown(connections, activeConn = null) {
    const active = activeConn || AppState.get('activeConnection');

    // Update topbar display
    const nameEl = document.getElementById('active-conn-name');
    if (nameEl) nameEl.textContent = active?.name || 'Select Connection';

    const dotEl = document.getElementById('active-conn-dot');
    if (dotEl) {
      dotEl.className = `connection-indicator ${active?.connected ? '' : 'disconnected'}`;
    }

    // Build dropdown items
    const dropdownList = document.getElementById('conn-dropdown-list');
    if (!dropdownList) return;

    dropdownList.innerHTML = connections.map(c => `
      <button class="dropdown-item ${c.id === active?.id ? 'active' : ''}" data-id="${c.id}">
        <span style="width:7px;height:7px;border-radius:50%;background:${c.connected ? 'var(--success)' : 'var(--text-muted)'};flex-shrink:0;"></span>
        ${DOM.escape(c.name)}
      </button>
    `).join('');

    dropdownList.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        _setActive(parseInt(btn.dataset.id));
        Dropdown.close('conn-dropdown-menu');
      });
    });
  }

  // ---- Add Connection Modal Handler ----

  function initAddConnectionModal() {
    const form = document.getElementById('add-connection-form');
    const testBtn = document.getElementById('test-conn-btn');
    const submitBtn = document.getElementById('save-conn-btn');
    const dbTypeSelect = document.getElementById('conn-db-type');

    // Toggle host/port fields for SQLite
    dbTypeSelect?.addEventListener('change', () => {
      const isSqlite = dbTypeSelect.value === 'sqlite';
      const hostFields = document.getElementById('conn-server-fields');
      if (hostFields) hostFields.style.display = isSqlite ? 'none' : 'grid';
    });

    testBtn?.addEventListener('click', async () => {
      const payload = _getFormPayload();
      if (!payload.database_name) { Toast.warning('Please fill in the database name.'); return; }

      Loading.setButton(testBtn, 'Testing...');
      const statusEl = document.getElementById('conn-test-status');

      try {
        const result = await api.testConnection(payload);
        if (statusEl) {
          statusEl.className = 'state-success';
          statusEl.style.display = 'flex';
          statusEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            ${DOM.escape(result.message || 'Connection successful!')}
          `;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'state-error';
          statusEl.style.display = 'flex';
          statusEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
            ${DOM.escape(err.message)}
          `;
        }
      } finally {
        Loading.resetButton(testBtn);
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = _getFormPayload();
      if (!payload.name || !payload.database_name) {
        Toast.warning('Connection name and database name are required.');
        return;
      }

      Loading.setButton(submitBtn, 'Saving...');

      try {
        const newConn = await api.createConnection(payload);
        const connections = [...AppState.get('connections'), newConn];
        AppState.set({ connections });

        Modal.close('add-connection-modal');
        form.reset();
        document.getElementById('conn-test-status')?.style.setProperty('display', 'none');
        Toast.success(`Connection "${newConn.name}" added.`);

        // Refresh if on connections page
        if (AppState.get('currentView') === 'connections') {
          _renderCards(connections, document.getElementById('connection-cards-list'));
        }
        _updateConnectionDropdown(connections);
      } catch (err) {
        Toast.error('Failed to save connection: ' + err.message);
      } finally {
        Loading.resetButton(submitBtn);
      }
    });
  }

  function _getFormPayload() {
    return {
      name:          document.getElementById('conn-name')?.value?.trim() || '',
      db_type:       document.getElementById('conn-db-type')?.value || 'postgresql',
      host:          document.getElementById('conn-host')?.value?.trim() || null,
      port:          parseInt(document.getElementById('conn-port')?.value) || null,
      username:      document.getElementById('conn-username')?.value?.trim() || null,
      password:      document.getElementById('conn-password')?.value || null,
      database_name: document.getElementById('conn-database')?.value?.trim() || '',
    };
  }

  // ---- Upload File Modal ----

  function initUploadModal() {
    const form    = document.getElementById('upload-file-form');
    const fileInput = document.getElementById('upload-file-input');
    const dropZone  = document.getElementById('upload-drop-zone');
    const fileName  = document.getElementById('upload-file-name');

    dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) { fileInput.files = e.dataTransfer.files; if (fileName) fileName.textContent = file.name; }
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file && fileName) fileName.textContent = file.name;
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = fileInput?.files[0];
      const name = document.getElementById('upload-conn-name')?.value?.trim() || file?.name;
      const btn  = document.getElementById('upload-submit-btn');

      if (!file) { Toast.warning('Please select a file to upload.'); return; }

      Loading.setButton(btn, 'Uploading...');
      try {
        const newConn = await api.uploadFileConnection(name, file);
        const connections = [...AppState.get('connections'), newConn];
        AppState.set({ connections });
        Modal.close('upload-file-modal');
        form.reset();
        if (fileName) fileName.textContent = 'No file selected';
        Toast.success(`"${newConn.name}" uploaded and ready.`);
        _updateConnectionDropdown(connections);
      } catch (err) {
        Toast.error('Upload failed: ' + err.message);
      } finally {
        Loading.resetButton(btn);
      }
    });
  }

  // ---- DB type Icon ----
  function _getDbIcon(dbType) {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`;
  }

  // ---- Load initial connection list ----
  async function loadConnections() {
    try {
      const connections = await api.getConnections();
      AppState.set({ connections });

      // Auto-select first connected connection
      const firstConnected = connections.find(c => c.connected) || connections[0];
      if (firstConnected && !AppState.get('activeConnection')) {
        AppState.set({ activeConnection: firstConnected });
      }

      _updateConnectionDropdown(connections);
    } catch (err) {
      console.warn('[Connections] Could not load connections:', err.message);
    }
  }

  return {
    render,
    loadConnections,
    initAddConnectionModal,
    initUploadModal,
    updateDropdown: _updateConnectionDropdown,
  };
})();
