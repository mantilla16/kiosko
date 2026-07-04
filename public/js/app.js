/* Aplicación principal: autenticación + selector de kiosko + enrutador por hash */
(function () {
  const loginScreen = document.getElementById('loginScreen');
  const appShell    = document.getElementById('appShell');
  const loginForm   = document.getElementById('loginForm');
  const loginError  = document.getElementById('loginError');
  const loginBtn    = document.getElementById('loginBtn');
  const view        = document.getElementById('view');
  const titleEl     = document.getElementById('viewTitle');
  const sidebar     = document.getElementById('sidebar');
  const kioskSelect = document.getElementById('kioskSelect');
  const userAvatar  = document.getElementById('userAvatar');
  const userName    = document.getElementById('userName');
  const userRole    = document.getElementById('userRole');
  const btnLogout   = document.getElementById('btnLogout');

  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  document.getElementById('hamburger').onclick = () => sidebar.classList.toggle('open');

  // Logout
  function doLogout() { API.logout(); showLogin(); }
  btnLogout.onclick = doLogout;
  window.addEventListener('auth:logout', showLogin);

  // Pantalla de login
  function showLogin() {
    appShell.hidden = true;
    loginScreen.classList.remove('hidden');
    loginError.hidden = true;
    loginForm.reset();
    U.initIcons(loginScreen);
    document.getElementById('loginUser').focus();
  }

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verificando…';
    loginError.hidden = true;
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión.');
      API.setToken(data.token);
      API.setUser(data.user);
      await initApp();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
    }
  };

  // Chip de usuario en topbar
  function paintUserChip(user) {
    const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    userAvatar.textContent = initials;
    userName.textContent   = user.name;
    userRole.textContent   = user.role === 'ADMIN' ? 'Administrador' : 'Operador';
    document.querySelectorAll('.admin-link, .admin-group').forEach((el) => {
      el.style.display = user.role === 'ADMIN' ? '' : 'none';
    });
  }

  // Selector de kioskos
  let kiosks = [];
  async function refreshKiosks() {
    kiosks = await API.get('/kiosks');
    let active = API.getKiosk();
    if (!active || !kiosks.some((k) => String(k.id) === String(active))) {
      active = kiosks.length ? String(kiosks[0].id) : '';
      API.setKiosk(active);
    }
    kioskSelect.innerHTML = kiosks.map((k) =>
      `<option value="${k.id}" ${String(k.id) === String(active) ? 'selected' : ''}>${U.escapeHtml(k.name)}</option>`
    ).join('');
    return kiosks;
  }
  window.refreshKiosks = refreshKiosks;

  kioskSelect.onchange = (e) => { API.setKiosk(e.target.value); router(); };

  // Enrutador por hash
  async function router() {
    const key   = (location.hash.replace('#/', '') || 'dashboard').trim();
    const route = window.Routes[key] || window.Routes.dashboard;
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
    titleEl.textContent = route.title;
    sidebar.classList.remove('open');

    if (!kiosks.length && key !== 'kioskos' && key !== 'usuarios') {
      view.innerHTML = `<div class="panel"><div class="panel-body">
        <h2>Bienvenido</h2>
        <p class="text-muted mt">Aún no hay kioskos creados. Crea el primero para empezar.</p>
        <a class="btn primary mt" href="#/kioskos">Ir a administrar kioskos</a>
      </div></div>`;
      return;
    }
    try {
      await route.render(view);
      U.initIcons(view);
    } catch (e) {
      view.innerHTML = `<div class="panel"><div class="panel-body">
        <h2 class="text-red">No se pudo cargar la información</h2>
        <p class="text-muted">${U.escapeHtml(e.message)}</p>
        <button class="btn primary mt" onclick="location.reload()">Reintentar</button>
      </div></div>`;
    }
  }
  window.appRouter = router;
  window.addEventListener('hashchange', router);

  // Inicializar app tras login exitoso
  async function initApp() {
    const user = API.getUser();
    if (!user) { showLogin(); return; }
    paintUserChip(user);
    loginScreen.classList.add('hidden');
    appShell.hidden = false;
    U.initIcons(appShell);
    try {
      await refreshKiosks();
    } catch (e) {
      view.innerHTML = `<div class="panel"><div class="panel-body"><h2 class="text-red">No se pudo conectar con el servidor</h2><p class="text-muted">${U.escapeHtml(e.message)}</p></div></div>`;
      return;
    }
    router();
  }

  // Arranque
  if (API.getToken()) { initApp(); } else { showLogin(); }
})();
