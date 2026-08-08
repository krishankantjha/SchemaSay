/**
 * SchemaSay — Chart Renderer
 * Chart.js wrapper with consistent styling and type switching.
 */

// ============================================================
// COLOR PALETTE
// ============================================================

const CHART_COLORS = {
  primary:   ['#0B6B57', '#1AAE9F', '#E7A72F', '#F59E0B', '#EF6A5E', '#A8C99B', '#064E3B', '#17a899'],
  borders:   ['#064E3B', '#17a899', '#c8920a', '#d08e09', '#d65a4e', '#8aad7f', '#032E27', '#138d84'],
  bgAlpha:   (hex, alpha) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },
};

const CHART_DEFAULTS = {
  font: { family: "'Inter', sans-serif", size: 12 },
  color: '#66736F',
};

// ============================================================
// CHART MANAGER
// ============================================================

const Charts = (() => {
  // Track active chart instances by canvas ID
  const _instances = {};

  /**
   * Destroy existing chart on a canvas if it exists
   */
  function _destroyIfExists(canvasId) {
    if (_instances[canvasId]) {
      _instances[canvasId].destroy();
      delete _instances[canvasId];
    }
  }

  /**
   * Build a dataset config for Chart.js
   */
  function _buildDataset(type, label, data) {
    const colors = CHART_COLORS.primary;
    if (type === 'bar') {
      return {
        label,
        data,
        backgroundColor: data.map((_, i) => CHART_COLORS.bgAlpha(colors[i % colors.length], 0.85)),
        borderColor:     data.map((_, i) => CHART_DEFAULTS.color),
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: data.map((_, i) => colors[i % colors.length]),
      };
    }
    if (type === 'line') {
      return {
        label,
        data,
        backgroundColor: CHART_COLORS.bgAlpha(colors[0], 0.10),
        borderColor: colors[0],
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: colors[0],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      };
    }
    if (type === 'doughnut' || type === 'pie') {
      return {
        label,
        data,
        backgroundColor: data.map((_, i) => CHART_COLORS.bgAlpha(colors[i % colors.length], 0.85)),
        borderColor: 'white',
        borderWidth: 2,
        hoverBorderWidth: 3,
      };
    }
    return { label, data };
  }

  /**
   * Build common Chart.js options
   */
  function _buildOptions(type, xLabel = '', yLabel = '') {
    const isDark = AppState.get('theme') === 'dark';
    const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const tickColor  = isDark ? '#88A09C' : '#66736F';

    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          display: type === 'doughnut' || type === 'pie',
          position: 'bottom',
          labels: {
            font: CHART_DEFAULTS.font,
            color: tickColor,
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: isDark ? '#1A2420' : 'white',
          titleColor: isDark ? '#E8EFED' : '#101817',
          bodyColor: isDark ? '#88A09C' : '#66736F',
          borderColor: isDark ? '#243230' : '#DDE3DC',
          borderWidth: 1,
          padding: 10,
          titleFont: { family: "'Outfit', sans-serif", size: 13, weight: 600 },
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label(ctx) {
              const val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
              return ` ${typeof val === 'number' ? val.toLocaleString() : val}`;
            },
          },
        },
      },
    };

    if (type === 'bar' || type === 'line') {
      base.scales = {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, font: CHART_DEFAULTS.font },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: CHART_DEFAULTS.font,
            callback: (v) => {
              if (v >= 1000000) return (v/1000000).toFixed(1) + 'M';
              if (v >= 1000) return (v/1000).toFixed(0) + 'K';
              return v;
            },
          },
          border: { display: false },
        },
      };
    }

    return base;
  }

  /**
   * Render or update a chart
   * @param {string} canvasId - ID of the <canvas> element
   * @param {string} type     - 'bar' | 'line' | 'doughnut'
   * @param {Array}  labels
   * @param {Array}  data     - numeric values
   * @param {string} dataLabel - dataset label
   * @param {string} title    - chart title
   */
  function render(canvasId, type, labels, data, dataLabel = 'Value', title = '') {
    _destroyIfExists(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`[Charts] Canvas not found: ${canvasId}`);
      return null;
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [ _buildDataset(type, dataLabel, data) ],
      },
      options: _buildOptions(type),
    });

    _instances[canvasId] = chart;
    return chart;
  }

  /**
   * Update chart type on an existing chart
   */
  function changeType(canvasId, newType) {
    const chart = _instances[canvasId];
    if (!chart) return;

    const labels   = chart.data.labels;
    const data     = chart.data.datasets[0].data;
    const label    = chart.data.datasets[0].label;

    render(canvasId, newType, labels, data, label);
  }

  /**
   * Render from a backend chart_config + rows
   */
  function renderFromConfig(canvasId, chartConfig, rows) {
    if (!chartConfig || !rows?.length) return;

    const { chart_type, x_axis, y_axis, title } = chartConfig;
    const labels = rows.map(r => r[x_axis] ?? '');
    const data   = rows.map(r => parseFloat(r[y_axis]) || 0);
    const type   = chart_type === 'bar' ? 'bar' : chart_type === 'line' ? 'line' : 'doughnut';

    return render(canvasId, type, labels, data, y_axis, title);
  }

  /**
   * Destroy chart instance
   */
  function destroy(canvasId) {
    _destroyIfExists(canvasId);
  }

  /**
   * Re-render all charts with updated theme colors
   */
  function refreshTheme() {
    Object.keys(_instances).forEach(id => {
      const chart = _instances[id];
      if (!chart) return;
      const type   = chart.config.type;
      const labels = chart.data.labels;
      const data   = chart.data.datasets[0].data;
      const label  = chart.data.datasets[0].label;
      render(id, type, labels, data, label);
    });
  }

  return { render, renderFromConfig, changeType, destroy, refreshTheme };
})();
