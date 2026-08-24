/**
 * SchemaSay — AI Copilot Module
 * Handles the natural language → SQL → results flow with stage animation.
 */

const Copilot = (() => {
  let _editor = null;   // CodeMirror instance for Generated SQL

  // ---- Stage definitions ----
  const STAGES = [
    { id: 'understand',  label: 'Understanding question...' },
    { id: 'schema',      label: 'Inspecting database schema...' },
    { id: 'generate',   label: 'Generating SQL...' },
    { id: 'validate',   label: 'Validating SQL...' },
    { id: 'execute',    label: 'Executing query...' },
    { id: 'results',    label: 'Preparing results...' },
  ];

  // ---- Init CodeMirror SQL Editor ----

  function initEditor(targetId) {
    const el = document.getElementById(targetId);
    if (!el || !window.CodeMirror) return;

    const isDark = AppState.get('theme') === 'dark';

    _editor = CodeMirror.fromTextArea(el, {
      mode: 'text/x-sql',
      theme: isDark ? 'dracula' : 'default',
      lineNumbers: true,
      indentWithTabs: false,
      smartIndent: true,
      lineWrapping: false,
      styleActiveLine: true,
      viewportMargin: Infinity,
      readOnly: false,
      extraKeys: {
        'Tab': cm => cm.replaceSelection('  '),
      },
    });

    _editor.setSize('100%', 'auto');

    // Register for theme updates
    if (!window._cmEditors) window._cmEditors = [];
    window._cmEditors.push(_editor);

    return _editor;
  }

  // ---- Stage Progress Rendering ----

  function _renderStages(container, activeIdx) {
    if (!container) return;
    container.innerHTML = STAGES.map((s, i) => {
      const state = i < activeIdx ? 'complete' : i === activeIdx ? 'running' : 'pending';
      let icon;
      if (state === 'complete') {
        icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`;
      } else if (state === 'running') {
        icon = `<span class="spinner sm" style="border-top-color:var(--orange);"></span>`;
      } else {
        icon = `<span style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border-dark);display:inline-block;flex-shrink:0;"></span>`;
      }
      return `
        <div class="processing-stage ${state}">
          <span class="stage-status-icon">${icon}</span>
          <span>${s.label}</span>
        </div>
      `;
    }).join('');
  }

  // ---- Main Query Flow ----

  async function executePrompt(question, connectionId) {
    if (!question.trim()) return;
    if (AppState.get('isExecuting')) return;

    AppState.set({ isExecuting: true, currentQuery: question });

    const sendBtn     = document.getElementById('copilot-send-btn');
    const processingEl = document.getElementById('copilot-processing');
    const sqlPanel    = document.getElementById('copilot-sql-panel');
    const resultsWrap = document.getElementById('copilot-results-wrap');
    const insightsBar = document.getElementById('insights-bar');
    const stageList   = processingEl?.querySelector('.processing-stages');

    // Disable send button
    if (sendBtn) sendBtn.disabled = true;

    // Show processing panel, hide old results
    if (processingEl) { processingEl.style.display = 'block'; }
    if (sqlPanel)     { sqlPanel.style.display = 'none'; }
    if (resultsWrap)  { resultsWrap.style.display = 'none'; }
    if (insightsBar)  { insightsBar.style.display = 'none'; }

    // Animate through stages
    const stageDurations = [400, 600, 500, 400, 300];

    try {
      for (let i = 0; i < STAGES.length - 1; i++) {
        _renderStages(stageList, i);
        await new Promise(r => setTimeout(r, stageDurations[i]));
      }

      // Call backend / demo API
      const data = await api.generateQuery(connectionId, question);

      if (data.success === false) {
        throw new Error(data.error || 'The assistant could not complete this query.');
      }

      // Mark last stage running, then done
      _renderStages(stageList, STAGES.length - 1);
      await new Promise(r => setTimeout(r, 300));
      _renderStages(stageList, STAGES.length);

      // Show execution meta
      const metaEl = processingEl?.querySelector('.processing-meta');
      if (metaEl) {
        metaEl.innerHTML = `
          <span class="meta-stat">✓ SQL generated</span>
          <span class="meta-stat">✓ SQL validated</span>
          <span class="meta-stat">✓ Query executed</span>
          <span class="meta-stat"><strong>${data.execution_duration_ms ? (data.execution_duration_ms / 1000).toFixed(2) + 's' : '—'}</strong></span>
        `;
      }

      // Populate SQL editor
      if (_editor) {
        _editor.setValue(data.sql || '');
        _editor.refresh();
      }

      // Show SQL panel
      if (sqlPanel) {
        sqlPanel.style.display = 'block';
        sqlPanel.style.animation = 'fadeInUp 250ms ease both';

        // Valid SQL badge
        const badge = sqlPanel.querySelector('#sql-valid-badge');
        if (badge) {
          badge.className = 'sql-valid-badge';
          badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Valid SQL`;
        }
      }

      // Render results
      const results = {
        columns: data.results?.length ? Object.keys(data.results[0]) : [],
        rows: data.results || [],
        rowCount: data.results?.length || 0,
        executionTime: (data.execution_duration_ms || 0) / 1000,
        chartConfig: data.chart_config,
        truncated: data.truncated === true,
      };

      AppState.set({ queryResult: results, currentSql: data.sql || '' });

      if (resultsWrap) {
        resultsWrap.style.display = 'block';
        resultsWrap.style.animation = 'fadeInUp 250ms ease both';
        QueryResults.render(results, resultsWrap);
      }

      // Add to history
      _addToHistory(question, data.sql, 'success', data.execution_duration_ms);

    } catch (err) {
      // Show error state
      _renderStages(stageList, -1);
      if (stageList) {
        stageList.innerHTML = `
          <div class="processing-stage failed">
            <span class="stage-status-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </span>
            <span>Query failed: ${DOM.escape(err.message)}</span>
          </div>
        `;
      }

      // Show SQL panel with invalid badge if we have SQL
      if (sqlPanel && _editor && _editor.getValue()) {
        sqlPanel.style.display = 'block';
        const badge = sqlPanel.querySelector('#sql-valid-badge');
        if (badge) {
          badge.className = 'sql-invalid-badge';
          badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Invalid SQL`;
        }
      }

      Toast.error(`Query failed: ${err.message}`);
      _addToHistory(question, '', 'failed', null);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      AppState.set({ isExecuting: false });
    }
  }

  function _addToHistory(question, sql, status, durationMs) {
    const conn = AppState.get('activeConnection');
    const history = AppState.get('queryHistory') || [];
    history.unshift({
      id: `h-${Date.now()}`,
      question,
      sql_query: sql,
      query_type: question === 'Manual SQL Editor Query' ? 'direct_sql' : 'assistant',
      status,
      execution_duration_ms: durationMs,
      connection_name: conn?.name || 'Unknown',
      created_at: new Date().toISOString(),
    });
    AppState.set({ queryHistory: history.slice(0, 50) }); // Keep last 50
  }

  // ---- Init Copilot View ----

  function init() {
    const input   = document.getElementById('copilot-input');
    const sendBtn = document.getElementById('copilot-send-btn');
    const chips   = document.querySelectorAll('.suggestion-chip');

    // Send on button click
    sendBtn?.addEventListener('click', _submit);

    // Send on Enter key (not Shift+Enter)
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _submit();
      }
    });

    // Suggestion chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.prompt;
        if (input) {
          input.value = text;
          input.focus();
        }
        // Auto-submit
        _submit();
      });
    });

    // SQL Panel actions
    document.getElementById('format-sql-btn')?.addEventListener('click', _formatSQL);
    document.getElementById('copy-sql-btn')?.addEventListener('click', _copySQL);
    document.getElementById('run-query-btn')?.addEventListener('click', _runSQL);

    // Init CodeMirror
    initEditor('generated-sql-editor');
  }

  function _submit() {
    const input = document.getElementById('copilot-input');
    const question = input?.value?.trim();
    if (!question) return;

    const conn = AppState.get('activeConnection');
    if (!conn) {
      Toast.warning('Please select a database connection first.');
      return;
    }

    executePrompt(question, conn.id);
  }

  async function _formatSQL() {
    if (!_editor) return;
    const sql = _editor.getValue();
    if (!sql.trim()) return;

    const btn = document.getElementById('format-sql-btn');
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
    const sql = _editor.getValue();
    const ok = await DOM.copyToClipboard(sql);
    if (ok) Toast.success('SQL copied to clipboard.');
    else    Toast.error('Failed to copy to clipboard.');
  }

  async function _runSQL() {
    if (!_editor) return;
    const sql = _editor.getValue().trim();
    if (!sql) return;

    const conn = AppState.get('activeConnection');
    if (!conn) { Toast.warning('No active connection.'); return; }

    const btn = document.getElementById('run-query-btn');
    Loading.setButton(btn, 'Running...');
    AppState.set({ isExecuting: true });

    const resultsWrap = document.getElementById('copilot-results-wrap');

    try {
      const data = await api.executeQuery(conn.id, sql);

      const results = api.toQueryResult(data);

      AppState.set({ queryResult: results, currentQuery: 'Manual SQL Editor Query', currentSql: sql });

      if (resultsWrap) {
        resultsWrap.style.display = 'block';
        QueryResults.render(results, resultsWrap);
      }

      _addToHistory('Manual SQL Editor Query', sql, 'success', data.execution_time_ms);
      Toast.success(`Query executed — ${results.rowCount} row(s) returned${results.truncated ? ' (limited)' : ''}.`);

    } catch (err) {
      _addToHistory('Manual SQL Editor Query', sql, 'failed', null);
      Toast.error(`Query failed: ${err.message}`);
      if (resultsWrap) {
        resultsWrap.innerHTML = `
          <div class="state-error" style="margin:16px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <div>
              <strong>Query execution failed</strong>
              <div style="margin-top:4px;">${DOM.escape(err.message)}</div>
            </div>
          </div>
        `;
        resultsWrap.style.display = 'block';
      }
    } finally {
      Loading.resetButton(btn);
      AppState.set({ isExecuting: false });
    }
  }

  return { init, executePrompt, initEditor };
})();
