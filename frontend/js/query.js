/**
 * SchemaSay — Query Results Renderer
 * Renders data table, pagination, sorting, chart panel, CSV export.
 */

const QueryResults = (() => {
  // ---- State ----
  let _result = null;
  let _sortCol = null;
  let _sortDir = 'asc';
  let _page    = 1;
  let _perPage = 25;

  // ---- Render Results Panel ----

  function render(result, container) {
    _result  = result;
    _page    = 1;
    _sortCol = null;
    _sortDir = 'asc';

    if (!container) return;

    const { columns, rows, rowCount, executionTime, chartConfig } = result;

    container.innerHTML = `
      <!-- Tabs Bar -->
      <div class="results-tabs-bar">
        <button class="results-tab active" data-tab="results" id="rtab-results">Results</button>
        <button class="results-tab" data-tab="chart" id="rtab-chart">Chart</button>
        <button class="results-tab" data-tab="insights" id="rtab-insights">AI Insights</button>
      </div>

      <!-- Results Panel -->
      <div id="rpanel-results" class="results-panel-body">
        <div class="results-toolbar">
          <span class="results-count">
            Query Results <strong>(${rowCount} row${rowCount !== 1 ? 's' : ''})</strong>
            <span style="margin-left:8px;font-size:var(--text-xs);color:var(--text-muted);">${DOM.formatDuration(executionTime * 1000)}</span>
          </span>
          <button class="btn btn-ghost btn-sm" id="export-csv-btn" style="display:flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
        <div id="results-table-container"></div>
        <div class="table-pagination" id="results-pagination"></div>
      </div>

      <!-- Chart Panel -->
      <div id="rpanel-chart" class="chart-panel" style="display:none;">
        <div class="chart-toolbar">
          <span class="chart-title">${DOM.escape(chartConfig?.title || 'Query Results')}</span>
          <select class="chart-type-select" id="chart-type-select">
            <option value="bar" ${chartConfig?.chart_type === 'bar' ? 'selected' : ''}>Bar Chart</option>
            <option value="line" ${chartConfig?.chart_type === 'line' ? 'selected' : ''}>Line Chart</option>
            <option value="doughnut">Doughnut</option>
          </select>
        </div>
        <div class="chart-canvas-wrap">
          <canvas id="main-result-chart"></canvas>
        </div>
      </div>

      <!-- Insights Panel -->
      <div id="rpanel-insights" class="insights-panel" style="display:none;">
        <div class="insights-header">
          <span class="insights-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            AI Insights
          </span>
          <button class="btn btn-ghost btn-sm" id="regen-insights-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Regenerate
          </button>
        </div>
        <div id="insights-content">
          <div class="state-empty">
            <p class="state-empty-desc">Click "Regenerate" to generate AI insights for this query.</p>
          </div>
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.results-tab').forEach(tab => {
      tab.addEventListener('click', () => _switchTab(container, tab.dataset.tab));
    });

    // CSV export
    container.querySelector('#export-csv-btn')?.addEventListener('click', () => _exportCSV(columns, rows));

    // Chart type change
    container.querySelector('#chart-type-select')?.addEventListener('change', (e) => {
      Charts.changeType('main-result-chart', e.target.value);
    });

    // Regenerate insights
    container.querySelector('#regen-insights-btn')?.addEventListener('click', () => _generateInsights(columns, rows));

    // Render table
    _renderTable(columns, rows, container);

    // Render chart
    setTimeout(() => {
      if (chartConfig) {
        Charts.renderFromConfig('main-result-chart', chartConfig, rows);
      } else {
        // Fallback: use first two columns
        const xCol = columns[0];
        const yCol = columns[1];
        if (xCol && yCol) {
          Charts.render('main-result-chart', 'bar',
            rows.map(r => r[xCol]),
            rows.map(r => parseFloat(r[yCol]) || 0),
            yCol, 'Query Results'
          );
        }
      }
    }, 100);

    // Auto-generate insights
    _generateInsights(columns, rows);
  }

  function _switchTab(container, tab) {
    // Deactivate all tabs
    container.querySelectorAll('.results-tab').forEach(t => t.classList.remove('active'));
    container.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    // Hide all panels
    ['results', 'chart', 'insights'].forEach(t => {
      const panel = container.querySelector(`#rpanel-${t}`);
      if (panel) panel.style.display = 'none';
    });

    // Show selected
    const active = container.querySelector(`#rpanel-${tab}`);
    if (active) active.style.display = 'block';

    // Trigger chart resize
    if (tab === 'chart') {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
  }

  // ---- Data Table ----

  function _renderTable(columns, rows, container) {
    const tableContainer = container.querySelector('#results-table-container');
    const paginationEl   = container.querySelector('#results-pagination');
    if (!tableContainer) return;

    // Sort
    let sortedRows = [...rows];
    if (_sortCol) {
      sortedRows.sort((a, b) => {
        const va = a[_sortCol];
        const vb = b[_sortCol];
        const na = parseFloat(va);
        const nb = parseFloat(vb);
        const isNum = !isNaN(na) && !isNaN(nb);
        const cmp = isNum ? (na - nb) : String(va).localeCompare(String(vb));
        return _sortDir === 'asc' ? cmp : -cmp;
      });
    }

    // Paginate
    const total   = sortedRows.length;
    const start   = (_page - 1) * _perPage;
    const end     = Math.min(start + _perPage, total);
    const pageRows = sortedRows.slice(start, end);

    // Detect numeric columns
    const numericCols = new Set(
      columns.filter(col => rows.every(r => !isNaN(parseFloat(r[col])) && r[col] !== null))
    );

    // Build table
    tableContainer.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              ${columns.map(col => `
                <th class="${_sortCol === col ? 'sorted' : ''}" data-col="${DOM.escape(col)}" aria-sort="${_sortCol === col ? (_sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">
                  ${DOM.escape(col)}
                  ${_sortCol === col ? (_sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${pageRows.length === 0
              ? `<tr><td colspan="${columns.length + 1}" style="text-align:center;padding:32px;color:var(--text-muted);">No results found</td></tr>`
              : pageRows.map((row, i) => `
                  <tr>
                    <td>${start + i + 1}</td>
                    ${columns.map(col => {
                      const val = row[col];
                      const isNum = numericCols.has(col);
                      return `<td class="${isNum ? 'numeric' : ''}">${isNum ? DOM.formatNumber(val) : DOM.escape(String(val ?? ''))}</td>`;
                    }).join('')}
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    `;

    // Sort click handlers
    tableContainer.querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (_sortCol === col) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortCol = col;
          _sortDir = 'asc';
        }
        _renderTable(columns, rows, container);
      });
    });

    // Pagination
    if (paginationEl) {
      const totalPages = Math.ceil(total / _perPage);
      if (totalPages <= 1) {
        paginationEl.innerHTML = '';
      } else {
        const pageNumbers = _getPageNumbers(totalPages, _page);
        paginationEl.innerHTML = `
          <span class="pagination-info">Showing ${start + 1}–${end} of ${total}</span>
          <div class="pagination-controls">
            <button class="pagination-btn" id="pg-prev" ${_page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
            ${pageNumbers.map(n => n === '...'
              ? `<span class="pagination-btn" style="border:none;cursor:default;">…</span>`
              : `<button class="pagination-btn ${n === _page ? 'active' : ''}" data-page="${n}">${n}</button>`
            ).join('')}
            <button class="pagination-btn" id="pg-next" ${_page >= totalPages ? 'disabled' : ''} aria-label="Next page">›</button>
          </div>
        `;

        paginationEl.querySelector('#pg-prev')?.addEventListener('click', () => {
          if (_page > 1) { _page--; _renderTable(columns, rows, container); }
        });
        paginationEl.querySelector('#pg-next')?.addEventListener('click', () => {
          if (_page < totalPages) { _page++; _renderTable(columns, rows, container); }
        });
        paginationEl.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            _page = parseInt(btn.dataset.page);
            _renderTable(columns, rows, container);
          });
        });
      }
    }
  }

  function _getPageNumbers(totalPages, current) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i);
    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  // ---- CSV Export ----

  function _exportCSV(columns, rows) {
    const csv = DOM.rowsToCSV(columns, rows);
    DOM.downloadFile(csv, `schemasay_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
    Toast.success('CSV exported successfully.');
  }

  // ---- AI Insights ----

  async function _generateInsights(columns, rows) {
    const insightContainer = document.getElementById('insights-content');
    if (!insightContainer) return;

    insightContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;color:var(--text-muted);font-size:var(--text-sm);">
        <span class="spinner sm"></span>
        Generating insights...
      </div>
    `;

    try {
      const question = AppState.get('currentQuery') || 'Analyze the results';
      const data = await api.generateInsights(rows, columns, question, AppState.get('currentSql') || 'SELECT results');
      const insights = Array.isArray(data.insights) ? data.insights : (data.insight ? [data.insight] : []);

      AppState.set({ insights });

      if (insights.length === 0) {
        insightContainer.innerHTML = `<div class="state-empty"><p class="state-empty-desc">No insights generated for this query.</p></div>`;
        return;
      }

      insightContainer.innerHTML = insights.map(text => `
        <div class="insight-bullet">
          <span class="insight-dot"></span>
          <p class="insight-text">${DOM.escape(text)}</p>
        </div>
      `).join('');

      // Also update bottom insights bar
      _updateInsightsBar(insights);

    } catch (err) {
      insightContainer.innerHTML = `
        <div class="state-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Could not generate insights. ${DOM.escape(err.message)}
        </div>
      `;
    }
  }

  function _updateInsightsBar(insights) {
    const bar = document.getElementById('insights-bar-text');
    if (bar && insights.length > 0) {
      bar.textContent = insights.slice(0, 2).join(' ');
    }
    const barWrap = document.getElementById('insights-bar');
    if (barWrap) barWrap.style.display = 'flex';
  }

  return { render };
})();
