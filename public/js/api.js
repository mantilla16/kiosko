/* Cliente de la API REST con soporte multi-kiosko y autenticación JWT */
const API = (() => {
  const base = '/api';
  const KIOSK_KEY = 'activeKioskId';
  const TOKEN_KEY = 'authToken';
  const USER_KEY  = 'authUser';

  const getKiosk  = () => localStorage.getItem(KIOSK_KEY) || '';
  const setKiosk  = (id) => { if (id) localStorage.setItem(KIOSK_KEY, id); else localStorage.removeItem(KIOSK_KEY); };
  const getToken  = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken  = (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };
  const getUser   = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
  const setUser   = (u) => { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); };

  function logout() {
    setToken(null); setUser(null);
    window.dispatchEvent(new Event('auth:logout'));
  }

  async function request(method, path, body) {
    const opts = { method, headers: {} };
    const kioskId = getKiosk();
    const token   = getToken();
    if (kioskId) opts.headers['X-Kiosk-Id'] = kioskId;
    if (token)   opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(base + path, opts);
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (res.status === 401) { logout(); throw new Error('Sesión expirada. Inicia sesión nuevamente.'); }
    if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
    return data;
  }

  const qs = (params) => {
    const clean = Object.entries(params || {}).filter(([, v]) => v !== '' && v != null);
    return clean.length ? '?' + clean.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
  };

  return {
    get:      (path, params) => request('GET', path + qs(params)),
    post:     (path, body)   => request('POST', path, body),
    put:      (path, body)   => request('PUT', path, body),
    del:      (path)         => request('DELETE', path),
    getKiosk, setKiosk,
    getToken, setToken,
    getUser,  setUser,
    logout,
  };
})();
