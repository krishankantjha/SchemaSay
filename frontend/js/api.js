/**
 * SchemaSay — Central API Module
 * All backend communication goes through this module.
 * Supports DEMO_MODE (true) for offline operation.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const FRONTEND_CONFIG = window.SCHEMASAY_CONFIG || {};
const DEMO_MODE = FRONTEND_CONFIG.demoMode === true;
const API_BASE_URL = FRONTEND_CONFIG.apiBaseUrl || 'http://localhost:8000/api/v1';

// ============================================================
// DEMO DATA
// ============================================================

const DEMO = {
  user: {
    id: 1,
    email: 'demo@schemasay.com',
    full_name: 'John Doe',
    role: 'Data Analyst',
  },

  connections: [
    { id: 1, name: 'Sales Analytics DB',    db_type: 'postgresql', host: 'db.sales.internal',  database_name: 'sales_db',      port: 5432, username: 'read_user', connected: true,  created_at: '2026-07-01T10:00:00' },
    { id: 2, name: 'Production PostgreSQL',  db_type: 'postgresql', host: 'prod.db.internal',   database_name: 'production_db', port: 5432, username: 'readonly', connected: false, created_at: '2026-06-15T08:30:00' },
    { id: 3, name: 'Marketing Analytics DB', db_type: 'mysql',      host: 'marketing.db.com',   database_name: 'marketing',     port: 3306, username: 'analyst',  connected: false, created_at: '2026-07-10T14:00:00' },
    { id: 4, name: 'Local SQLite',           db_type: 'sqlite',     host: null,                 database_name: 'local.db',      port: null, username: null,       connected: true,  created_at: '2026-08-01T09:15:00' },
  ],

  schema: {
    tables: [
      { name: 'customers',   columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'first_name', type: 'varchar', pk: false, fk: false }, { name: 'last_name', type: 'varchar', pk: false, fk: false }, { name: 'email', type: 'varchar', pk: false, fk: false }, { name: 'phone', type: 'varchar', pk: false, fk: false }, { name: 'city', type: 'varchar', pk: false, fk: false }, { name: 'country', type: 'varchar', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'orders',      columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'customer_id', type: 'int', pk: false, fk: true }, { name: 'order_date', type: 'timestamp', pk: false, fk: false }, { name: 'status', type: 'varchar', pk: false, fk: false }, { name: 'total_amount', type: 'decimal', pk: false, fk: false }, { name: 'payment_method', type: 'varchar', pk: false, fk: false }, { name: 'shipping_address', type: 'text', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false }, { name: 'updated_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'order_items', columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'order_id', type: 'int', pk: false, fk: true }, { name: 'product_id', type: 'int', pk: false, fk: true }, { name: 'quantity', type: 'int', pk: false, fk: false }, { name: 'unit_price', type: 'decimal', pk: false, fk: false }, { name: 'total_amount', type: 'decimal', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'products',    columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'name', type: 'varchar', pk: false, fk: false }, { name: 'description', type: 'text', pk: false, fk: false }, { name: 'category_id', type: 'int', pk: false, fk: true }, { name: 'price', type: 'decimal', pk: false, fk: false }, { name: 'stock_quantity', type: 'int', pk: false, fk: false }, { name: 'sku', type: 'varchar', pk: false, fk: false }, { name: 'is_active', type: 'boolean', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'categories',  columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'name', type: 'varchar', pk: false, fk: false }, { name: 'slug', type: 'varchar', pk: false, fk: false }, { name: 'parent_id', type: 'int', pk: false, fk: true } ] },
      { name: 'suppliers',   columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'name', type: 'varchar', pk: false, fk: false }, { name: 'email', type: 'varchar', pk: false, fk: false }, { name: 'country', type: 'varchar', pk: false, fk: false }, { name: 'phone', type: 'varchar', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'payments',    columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'order_id', type: 'int', pk: false, fk: true }, { name: 'amount', type: 'decimal', pk: false, fk: false }, { name: 'method', type: 'varchar', pk: false, fk: false }, { name: 'status', type: 'varchar', pk: false, fk: false }, { name: 'paid_at', type: 'timestamp', pk: false, fk: false }, { name: 'transaction_id', type: 'varchar', pk: false, fk: false } ] },
      { name: 'inventory',   columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'product_id', type: 'int', pk: false, fk: true }, { name: 'quantity', type: 'int', pk: false, fk: false }, { name: 'warehouse', type: 'varchar', pk: false, fk: false }, { name: 'updated_at', type: 'timestamp', pk: false, fk: false }, { name: 'reorder_level', type: 'int', pk: false, fk: false } ] },
      { name: 'reviews',     columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'product_id', type: 'int', pk: false, fk: true }, { name: 'customer_id', type: 'int', pk: false, fk: true }, { name: 'rating', type: 'int', pk: false, fk: false }, { name: 'comment', type: 'text', pk: false, fk: false }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'shippings',   columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'order_id', type: 'int', pk: false, fk: true }, { name: 'carrier', type: 'varchar', pk: false, fk: false }, { name: 'tracking_number', type: 'varchar', pk: false, fk: false }, { name: 'status', type: 'varchar', pk: false, fk: false }, { name: 'shipped_at', type: 'timestamp', pk: false, fk: false }, { name: 'delivered_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'employees',   columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'first_name', type: 'varchar', pk: false, fk: false }, { name: 'last_name', type: 'varchar', pk: false, fk: false }, { name: 'email', type: 'varchar', pk: false, fk: false }, { name: 'department', type: 'varchar', pk: false, fk: false }, { name: 'hire_date', type: 'date', pk: false, fk: false }, { name: 'salary', type: 'decimal', pk: false, fk: false }, { name: 'manager_id', type: 'int', pk: false, fk: true }, { name: 'created_at', type: 'timestamp', pk: false, fk: false } ] },
      { name: 'regions',     columns: [ { name: 'id', type: 'int', pk: true, fk: false }, { name: 'name', type: 'varchar', pk: false, fk: false }, { name: 'country', type: 'varchar', pk: false, fk: false }, { name: 'code', type: 'varchar', pk: false, fk: false } ] },
    ],
  },

  queryResult: {
    columns: ['product_name', 'total_sales'],
    rows: [
      { product_name: 'Wireless Earbuds',    total_sales: 125430.50 },
      { product_name: 'Smart Watch',          total_sales: 98765.20  },
      { product_name: 'Mechanical Keyboard',  total_sales: 75310.00  },
      { product_name: 'Gaming Mouse',         total_sales: 62145.75  },
      { product_name: '4K Monitor',           total_sales: 54890.30  },
    ],
    rowCount: 5,
    executionTime: 0.82,
    truncated: false,
    queryId: 'demo-001',
    chartConfig: { chart_type: 'bar', x_axis: 'product_name', y_axis: 'total_sales', title: 'Top 5 Products by Total Sales' },
  },

  generatedSQL: `SELECT product_name,
       SUM(total_amount) AS total_sales
FROM order_items oi
JOIN orders o
  ON oi.order_id = o.id
WHERE o.order_date >= '2024-07-01'
  AND o.order_date < '2024-08-01'
GROUP BY product_name
ORDER BY total_sales DESC
LIMIT 5;`,

  insights: [
    'Wireless Earbuds are the top performer with $125.43K in total sales for July 2024, contributing 28.7% of total revenue across all product categories.',
    'Smart Watch ranks second with $98.77K (22.6%), followed by Mechanical Keyboard with $75.31K (17.2%). These three products collectively drive 68.5% of revenue.',
    'Gaming Mouse and 4K Monitor show strong mid-tier performance with $62.15K and $54.89K respectively. Consider bundling strategies with top performers to increase attachment rates.',
  ],

  queryHistory: [
    { id: 'h1', question: 'Show top 5 products by total sales in July 2024', sql_query: "SELECT product_name, SUM(total_amount) AS total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.order_date >= '2024-07-01' GROUP BY product_name ORDER BY total_sales DESC LIMIT 5;", status: 'success', execution_duration_ms: 820, connection_name: 'Sales Analytics DB', created_at: '2026-08-08T22:15:00' },
    { id: 'h2', question: 'Count total customers registered this month', sql_query: "SELECT COUNT(*) AS total_customers FROM customers WHERE created_at >= date_trunc('month', CURRENT_DATE);", status: 'success', execution_duration_ms: 145, connection_name: 'Sales Analytics DB', created_at: '2026-08-08T20:30:00' },
    { id: 'h3', question: 'List products with stock below 50 units', sql_query: 'SELECT p.name, i.quantity, i.warehouse FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.quantity < 50 ORDER BY i.quantity ASC;', status: 'success', execution_duration_ms: 230, connection_name: 'Local SQLite', created_at: '2026-08-07T15:45:00' },
    { id: 'h4', question: 'Monthly revenue trend for last 6 months', sql_query: "SELECT date_trunc('month', order_date) AS month, SUM(total_amount) AS revenue FROM orders WHERE order_date >= NOW() - INTERVAL '6 months' GROUP BY 1 ORDER BY 1;", status: 'success', execution_duration_ms: 1050, connection_name: 'Sales Analytics DB', created_at: '2026-08-07T10:10:00' },
    { id: 'h5', question: 'Top customers by total revenue this year', sql_query: "SELECT c.first_name || ' ' || c.last_name AS customer_name, SUM(o.total_amount) AS total_spend FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.order_date >= '2024-01-01' GROUP BY c.id ORDER BY total_spend DESC LIMIT 10;", status: 'failed', execution_duration_ms: 2100, connection_name: 'Production PostgreSQL', created_at: '2026-08-06T16:00:00' },
  ],

  kpis: {
    totalRevenue: '$1,247,832',
    totalOrders: '14,392',
    avgOrderValue: '$86.70',
    topProduct: 'Wireless Earbuds',
    revenueChange: '+12.4%',
    ordersChange: '+8.2%',
    aovChange: '+3.8%',
  },

  revenueData: {
    labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    values: [185420, 210340, 198760, 232100, 255840, 247832],
  },

  regionData: {
    labels: ['North', 'East', 'South', 'West'],
    values: [312400, 281600, 198000, 245800],
  },
};

// ============================================================
// HTTP HELPER
// ============================================================

async function _refreshAccessToken() {
  const refreshToken = AppState.get('refreshToken');
  if (!refreshToken) return false;
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  AppState.saveToken(data.access_token);
  AppState.saveRefreshToken(data.refresh_token);
  return true;
}

async function _fetch(endpoint, options = {}, allowRefresh = true) {
  const token = AppState.get('authToken');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (response.status === 401 && allowRefresh && !endpoint.startsWith('/auth/')) {
      if (await _refreshAccessToken()) return _fetch(endpoint, options, false);
    }
    if (response.status === 401) {
      AppState.clearToken();
      window.location.hash = '#login';
      throw new Error('Session expired. Please log in again.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || `Request failed (${response.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check that the backend is running.');
    }
    throw err;
  }
}

async function _fetchMultipart(endpoint, formData, allowRefresh = true) {
  const token = AppState.get('authToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 && allowRefresh && !endpoint.startsWith('/auth/')) {
      if (await _refreshAccessToken()) return _fetchMultipart(endpoint, formData, false);
    }
    if (response.status === 401) {
      AppState.clearToken();
      window.location.hash = '#login';
      throw new Error('Session expired. Please log in again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check that the backend is running.');
    }
    throw err;
  }
}

function _normalizeSchemaResponse(payload) {
  const entries = Array.isArray(payload) ? payload : (Array.isArray(payload?.tables) ? payload.tables : []);
  const grouped = new Map();

  entries.forEach(entry => {
    const tableName = entry?.table_name || entry?.name;
    if (!tableName) return;

    if (!grouped.has(tableName)) grouped.set(tableName, []);
    const columns = Array.isArray(entry.columns)
      ? entry.columns
      : [entry];

    columns.forEach(column => {
      const columnName = column?.column_name || column?.name;
      if (!columnName) return;
      const normalized = {
        name: columnName,
        type: column?.data_type || column?.type || 'unknown',
      };
      if (column?.pk !== undefined) normalized.pk = Boolean(column.pk);
      if (column?.fk !== undefined) normalized.fk = Boolean(column.fk);

      const existing = grouped.get(tableName);
      if (!existing.some(item => item.name === normalized.name)) existing.push(normalized);
    });
  });

  return {
    tables: Array.from(grouped, ([name, columns]) => ({ name, columns })),
  };
}

function _normalizeAssistantResponse(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return {
    ...payload,
    sql: payload?.sql || '',
    success: payload?.success !== false,
    error: payload?.error ?? null,
    results,
    execution_duration_ms: Number(payload?.execution_duration_ms ?? 0) || 0,
    truncated: payload?.truncated === true,
    chart_config: payload?.chart_config || null,
  };
}

function _normalizeDirectQueryResponse(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const columns = Array.isArray(payload?.columns) && payload.columns.length
    ? payload.columns
    : (rows[0] ? Object.keys(rows[0]) : []);
  return {
    ...payload,
    columns,
    rows,
    row_count: Number(payload?.row_count ?? rows.length) || 0,
    execution_time_ms: Number(payload?.execution_time_ms ?? 0) || 0,
    truncated: payload?.truncated === true,
    chart_config: payload?.chart_config || null,
  };
}

function _normalizeInsightsResponse(payload) {
  const insights = Array.isArray(payload?.insights)
    ? payload.insights
    : (payload?.insight ? [payload.insight] : []);
  return { ...payload, insights };
}

function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// API METHODS
// ============================================================

const api = {

  // ---- Auth ----

  async login(email, password) {
    if (DEMO_MODE) {
      await _delay(800);
      if (email && password) {
        return { access_token: 'demo-token-abc123', refresh_token: 'demo-refresh-xyz', token_type: 'bearer' };
      }
      throw new Error('Invalid credentials. Please try again.');
    }
    return _fetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async register(email, password, fullName) {
    if (DEMO_MODE) {
      await _delay(1000);
      if (!email || !password || !fullName) throw new Error('All fields are required.');
      return { id: 2, email, full_name: fullName };
    }
    return _fetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name: fullName }) });
  },

  async getMe() {
    if (DEMO_MODE) {
      await _delay(200);
      return DEMO.user;
    }
    return _fetch('/auth/me');
  },

  async logout() {
    if (DEMO_MODE) {
      await _delay(300);
      return { success: true };
    }
    return _fetch('/auth/logout', { method: 'POST' });
  },

  // ---- Connections ----

  async getConnections() {
    if (DEMO_MODE) {
      await _delay(400);
      return DEMO.connections;
    }
    return _fetch('/connections/');
  },

  async createConnection(payload) {
    if (DEMO_MODE) {
      await _delay(900);
      const newConn = {
        id: Date.now(),
        name: payload.name,
        db_type: payload.db_type,
        host: payload.host || null,
        database_name: payload.database_name,
        port: payload.port || null,
        username: payload.username || null,
        connected: false,
        created_at: new Date().toISOString(),
      };
      DEMO.connections.push(newConn);
      return newConn;
    }
    return _fetch('/connections/', { method: 'POST', body: JSON.stringify(payload) });
  },

  async testConnection(payload) {
    if (DEMO_MODE) {
      await _delay(1200);
      // Simulate connection test — succeed for known types
      if (payload.host && payload.username && payload.password) {
        return { success: true, message: 'Connection test succeeded!' };
      }
      throw new Error('Connection failed: Could not authenticate with provided credentials.');
    }
    return _fetch('/connections/test', { method: 'POST', body: JSON.stringify(payload) });
  },

  async deleteConnection(connectionId) {
    if (DEMO_MODE) {
      await _delay(500);
      const idx = DEMO.connections.findIndex(c => c.id === connectionId);
      if (idx >= 0) DEMO.connections.splice(idx, 1);
      return { message: 'Connection deleted successfully.' };
    }
    return _fetch(`/connections/${connectionId}`, { method: 'DELETE' });
  },

  async uploadFileConnection(name, file) {
    if (DEMO_MODE) {
      await _delay(1500);
      const newConn = {
        id: Date.now(),
        name,
        db_type: 'sqlite',
        host: null,
        database_name: file.name,
        port: null,
        username: null,
        connected: true,
        created_at: new Date().toISOString(),
      };
      DEMO.connections.push(newConn);
      return newConn;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    return _fetchMultipart('/connections/upload', formData);
  },

  // ---- Schema ----

  async getSchema(connectionId) {
    if (DEMO_MODE) {
      await _delay(500);
      return _normalizeSchemaResponse(DEMO.schema);
    }
    const data = await _fetch(`/schema/${connectionId}`);
    return _normalizeSchemaResponse(data);
  },

  async syncSchema(connectionId) {
    if (DEMO_MODE) {
      await _delay(1800);
      return { message: 'Schema synchronized successfully.' };
    }
    return _fetch(`/schema/${connectionId}/sync`, { method: 'POST' });
  },

  // ---- AI Query Generation ----

  async generateQuery(connectionId, question) {
    if (DEMO_MODE) {
      await _delay(2000);
      return _normalizeAssistantResponse({
        sql: DEMO.generatedSQL,
        success: true,
        error: null,
        results: DEMO.queryResult.rows,
        execution_duration_ms: 820,
        chart_config: DEMO.queryResult.chartConfig,
      });
    }
    const data = await _fetch('/assistant/query', {
      method: 'POST',
      body: JSON.stringify({ connection_id: connectionId, question }),
    });
    return _normalizeAssistantResponse(data);
  },

  // ---- SQL Execution ----

  async executeQuery(connectionId, sqlQuery) {
    if (DEMO_MODE) {
      await _delay(700);
      // Simple mock: if the SQL looks like a SELECT, return data
      if (sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
        return _normalizeDirectQueryResponse({
          columns: DEMO.queryResult.columns,
          rows: DEMO.queryResult.rows,
          row_count: DEMO.queryResult.rowCount,
          execution_time_ms: 320,
          truncated: false,
          query_id: `demo-${Date.now()}`,
          chart_config: DEMO.queryResult.chartConfig,
        });
      }
      throw new Error('SQL Validation Error: Only SELECT statements are permitted. Destructive statements are blocked by the security sandbox.');
    }
    const data = await _fetch('/query/execute', {
      method: 'POST',
      body: JSON.stringify({ connection_id: connectionId, sql_query: sqlQuery }),
    });
    return _normalizeDirectQueryResponse(data);
  },

  async formatQuery(sqlQuery) {
    if (DEMO_MODE) {
      await _delay(300);
      // Basic JS formatting simulation
      let formatted = sqlQuery
        .replace(/\bSELECT\b/gi,  '\nSELECT')
        .replace(/\bFROM\b/gi,    '\nFROM')
        .replace(/\bWHERE\b/gi,   '\nWHERE')
        .replace(/\bAND\b/gi,     '\n  AND')
        .replace(/\bOR\b/gi,      '\n  OR')
        .replace(/\bJOIN\b/gi,    '\nJOIN')
        .replace(/\bON\b/gi,      '\n  ON')
        .replace(/\bGROUP BY\b/gi,'\nGROUP BY')
        .replace(/\bORDER BY\b/gi,'\nORDER BY')
        .replace(/\bLIMIT\b/gi,   '\nLIMIT')
        .replace(/\bHAVING\b/gi,  '\nHAVING')
        .trim();
      return { formatted_sql: formatted };
    }
    return _fetch('/query/format', {
      method: 'POST',
      body: JSON.stringify({ sql_query: sqlQuery }),
    });
  },

  // ---- AI Insights ----

  async generateInsights(rows, columns, question, sqlQuery = '') {
    if (DEMO_MODE) {
      await _delay(1500);
      return _normalizeInsightsResponse({ insights: DEMO.insights });
    }
    const data = await _fetch('/insights/generate', {
      method: 'POST',
      body: JSON.stringify({ rows, columns, question, sql_query: sqlQuery || 'SELECT results' }),
    });
    return _normalizeInsightsResponse(data);
  },

  // ---- Query History ----

  async getQueryHistory(page = 1, limit = 20, connectionId = null) {
    if (DEMO_MODE) {
      await _delay(400);
      let history = [...DEMO.queryHistory];
      if (connectionId) {
        const conn = DEMO.connections.find(c => c.id === connectionId);
        if (conn) history = history.filter(h => h.connection_name === conn.name);
      }
      const start = (page - 1) * limit;
      return history.slice(start, start + limit);
    }
    const params = new URLSearchParams({ page, limit });
    if (connectionId) params.set('connection_id', connectionId);
    return _fetch(`/connections/history?${params.toString()}`);
  },
};
