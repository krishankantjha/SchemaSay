/**
 * SchemaSay — Authentication Module
 * Login, register, logout views & token management.
 */

const Auth = (() => {
  // ---- Elements ----
  let authOverlay, loginForm, registerForm, authError;
  let loginTab, registerTab;
  let loginFormEl, registerFormEl;
  let initialized = false;

  function _init() {
    if (initialized) return;
    initialized = true;

    authOverlay  = document.getElementById('auth-overlay');
    loginTab     = document.getElementById('auth-tab-login');
    registerTab  = document.getElementById('auth-tab-register');
    loginFormEl  = document.getElementById('login-form');
    registerFormEl = document.getElementById('register-form');
    authError    = document.getElementById('auth-error');

    // Tab switching
    loginTab?.addEventListener('click', () => _showTab('login'));
    registerTab?.addEventListener('click', () => _showTab('register'));

    // Error dismiss button
    document.getElementById('auth-error-dismiss')?.addEventListener('click', _clearError);

    // Password visibility toggle
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.for;
        const input = document.getElementById(inputId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.innerHTML = isPassword
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });

    // Form submissions
    loginFormEl?.addEventListener('submit', (e) => { e.preventDefault(); _handleLogin(); });
    registerFormEl?.addEventListener('submit', (e) => { e.preventDefault(); _handleRegister(); });
  }

  function _showTab(tab) {
    if (tab === 'login') {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginFormEl.classList.remove('hidden');
      registerFormEl.classList.add('hidden');
    } else {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerFormEl.classList.remove('hidden');
      loginFormEl.classList.add('hidden');
    }
    _clearError();
  }

  function _showError(msg) {
    if (authError) {
      authError.querySelector('.auth-error-text').textContent = msg;
      authError.classList.remove('hidden');
    }
  }

  function _clearError() {
    if (authError) authError.classList.add('hidden');
  }

  async function _handleLogin() {
    const email    = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const btn      = document.getElementById('login-submit-btn');

    if (!email || !password) {
      _showError('Please enter your email and password.');
      return;
    }

    _clearError();
    Loading.setButton(btn, 'Signing in...');

    try {
      const data = await api.login(email, password);
      AppState.saveToken(data.access_token);
      AppState.saveRefreshToken(data.refresh_token);

      // Load user profile
      const user = await api.getMe();
      AppState.set({ user });

      // Update UI with user info
      _updateUserDisplay(user);

      // Hide auth overlay
      show();

      Toast.success(`Welcome back, ${user.full_name}!`);

      // Navigate to dashboard
      Router.navigate('dashboard');

    } catch (err) {
      _showError(err.message || 'Login failed. Please try again.');
    } finally {
      Loading.resetButton(btn);
    }
  }

  async function _handleRegister() {
    const fullName = document.getElementById('register-name')?.value?.trim();
    const email    = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value;
    const confirm  = document.getElementById('register-confirm')?.value;
    const btn      = document.getElementById('register-submit-btn');

    if (!fullName || !email || !password) {
      _showError('All fields are required.');
      return;
    }

    if (password.length < 8) {
      _showError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirm) {
      _showError('Passwords do not match.');
      return;
    }

    _clearError();
    Loading.setButton(btn, 'Creating account...');

    try {
      await api.register(email, password, fullName);

      // Auto-login after registration
      const data = await api.login(email, password);
      AppState.saveToken(data.access_token);
      AppState.saveRefreshToken(data.refresh_token);

      const user = await api.getMe();
      AppState.set({ user });
      _updateUserDisplay(user);

      show();
      Toast.success(`Welcome to SchemaSay, ${user.full_name}!`);
      Router.navigate('dashboard');

    } catch (err) {
      _showError(err.message || 'Registration failed. Please try again.');
    } finally {
      Loading.resetButton(btn);
    }
  }

  function _updateUserDisplay(user) {
    if (!user) return;
    const initials = user.full_name
      ?.split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??';

    // Update sidebar user avatar
    const avatarEls = document.querySelectorAll('.user-avatar');
    avatarEls.forEach(el => { el.textContent = initials; });

    // Update sidebar user name / role
    const nameEls = document.querySelectorAll('.sidebar-user-name');
    nameEls.forEach(el => { el.textContent = user.full_name || 'User'; });

    const roleEls = document.querySelectorAll('.sidebar-user-role');
    roleEls.forEach(el => { el.textContent = user.role || user.email || ''; });

    // Update topbar avatar
    const topbarAvatar = document.getElementById('topbar-user-avatar');
    if (topbarAvatar) topbarAvatar.textContent = initials;

    const topbarName = document.getElementById('topbar-user-name');
    if (topbarName) topbarName.textContent = user.full_name;

    const topbarRole = document.getElementById('topbar-user-role');
    if (topbarRole) topbarRole.textContent = user.role || 'User';

    const dropdownName = document.getElementById('user-dropdown-name');
    if (dropdownName) dropdownName.textContent = user.full_name || 'User';
  }

  // ---- Public API ----
  function show() {
    // Show the main app, hide auth overlay
    authOverlay?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
  }

  function hide() {
    // Show auth overlay, hide main app
    authOverlay?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    _showTab('login');
  }

  async function logout() {
    try {
      await api.logout();
    } catch (e) { /* ignore */ }

    AppState.clearToken();
    AppState.reset();

    // Reset user display
    const avatarEls = document.querySelectorAll('.user-avatar');
    avatarEls.forEach(el => { el.textContent = '?'; });

    hide();
    Toast.info('You have been signed out.');
  }

  async function checkSession() {
    const token = AppState.loadToken();
    if (!token) {
      hide();
      return false;
    }

    try {
      const user = await api.getMe();
      AppState.set({ user });
      _updateUserDisplay(user);
      show();
      return true;
    } catch (e) {
      AppState.clearToken();
      hide();
      return false;
    }
  }

  return { init: _init, show, hide, logout, checkSession, updateUserDisplay: _updateUserDisplay };
})();
