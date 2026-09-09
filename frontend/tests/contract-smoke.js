const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');

function loadScript(relativePath, context, exportName) {
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(`${source}\nthis.__exported = ${exportName};`, context, { filename: relativePath });
  return context.__exported;
}

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    has: key => values.has(key),
  };
}

function testStateTokenStorage() {
  const sessionStorage = createStorage();
  const firstContext = { sessionStorage, localStorage: createStorage(), console };
  const firstState = loadScript('frontend/js/state.js', firstContext, 'AppState');
  firstState.saveToken('short-lived-access');
  firstState.saveRefreshToken('rotated-refresh');
  assert.strictEqual(sessionStorage.has('ss_token'), false, 'access token must not be persisted');
  assert.strictEqual(sessionStorage.getItem('ss_refresh_token'), 'rotated-refresh');

  const secondContext = { sessionStorage, localStorage: createStorage(), console };
  const secondState = loadScript('frontend/js/state.js', secondContext, 'AppState');
  assert.strictEqual(secondState.loadToken(), null, 'access token must not survive reload');
  assert.strictEqual(secondState.get('refreshToken'), 'rotated-refresh');
}

async function testApiNormalization() {
  const state = {
    authToken: null,
    refreshToken: null,
    get: key => state[key],
    set: updates => Object.assign(state, updates),
    saveToken: token => { state.authToken = token; },
    saveRefreshToken: token => { state.refreshToken = token; },
    clearToken: () => { state.authToken = null; state.refreshToken = null; },
  };
  const context = {
    window: { SCHEMASAY_CONFIG: { demoMode: false, apiBaseUrl: 'https://api.example.test/api/v1' } },
    AppState: state,
    console,
    fetch: async (url, options) => {
      assert.strictEqual(url, 'https://api.example.test/api/v1/schema/42');
      assert.strictEqual(options.headers.Authorization, 'Bearer access-token');
      return {
        ok: true,
        status: 200,
        json: async () => [
          { table_name: 'orders', column_name: 'id', data_type: 'integer' },
          { table_name: 'orders', column_name: 'total', data_type: 'numeric' },
        ],
      };
    },
  };
  state.authToken = 'access-token';
  const api = loadScript('frontend/js/api.js', context, 'api');
  const schema = await api.getSchema(42);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(schema)), {
    tables: [{ name: 'orders', columns: [{ name: 'id', type: 'integer' }, { name: 'total', type: 'numeric' }] }],
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.toQueryResult({
    columns: ['id'],
    rows: [{ id: 7 }],
    row_count: 1,
    execution_time_ms: 125,
    truncated: true,
    chart_config: { chart_type: 'table' },
  }))), {
    columns: ['id'],
    rows: [{ id: 7 }],
    rowCount: 1,
    executionTime: 0.125,
    chartConfig: { chart_type: 'table' },
    truncated: true,
  });
}

function testCleanupArtifacts() {
  assert.strictEqual(fs.existsSync(path.join(root, 'frontend/css/auth.css')), false, 'empty auth stylesheet should be removed');
  const frontendRequirements = fs.readFileSync(path.join(root, 'frontend/requirements.txt'), 'utf8');
  assert.doesNotMatch(frontendRequirements, /(?:openpyxl|xlrd)/, 'frontend should not install backend-only spreadsheet parsers');
  assert.strictEqual(fs.existsSync(path.join(root, 'backend/requirements.lock')), false, 'stale backend lockfile should be removed');
  assert.strictEqual(fs.existsSync(path.join(root, 'backend/app/utils/seed_demo.py')), false, 'obsolete demo seeder should be removed');
}

function testRuntimeConfiguration() {
  const html = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8');
  const externalAssets = html.match(/<(?:script|link)[^>]+(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)[^>]+>/g) || [];
  assert.ok(externalAssets.length > 0, 'expected pinned external browser assets');
  externalAssets.forEach(asset => {
    assert.match(asset, /integrity="sha384-[^"]+"/);
    assert.match(asset, /crossorigin="anonymous"/);
  });

  const app = fs.readFileSync(path.join(root, 'frontend/app.py'), 'utf8');
  assert.match(app, /SCHEMASAY_ENV/);
  assert.match(app, /must use HTTPS in production/);

  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.match(env, /ALLOWED_ORIGINS=/);
}

(async () => {
  testStateTokenStorage();
  await testApiNormalization();
  testRuntimeConfiguration();
  testCleanupArtifacts();
  console.log('Frontend contract smoke tests passed');
})();
