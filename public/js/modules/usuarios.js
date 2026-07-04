/* Módulo: Gestión de Usuarios (solo ADMIN) */
window.Routes = window.Routes || {};
window.Routes.usuarios = {
  title: 'Usuarios',
  async render(view) {
    const me = API.getUser();
    if (!me || me.role !== 'ADMIN') {
      view.innerHTML = `<div class="panel"><div class="panel-body">
        <h2 class="text-red">Acceso denegado</h2>
        <p class="text-muted">Solo los administradores pueden gestionar usuarios.</p>
      </div></div>`;
      return;
    }

    async function load() {
      view.innerHTML = '<div class="loader">Cargando usuarios…</div>';
      const users = await API.get('/users');
      paint(users);
    }

    function roleLabel(role) {
      return role === 'ADMIN'
        ? '<span class="badge blue">Admin</span>'
        : '<span class="badge gray">Operador</span>';
    }

    function paint(users) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head">
            <h2>Gestión de Usuarios</h2>
            <button class="btn primary" id="btnNew">+ Nuevo usuario</button>
          </div>
          <div class="panel-body">
            ${U.table(
              [
                { key: 'username',  label: 'Usuario' },
                { key: 'name',      label: 'Nombre' },
                { key: 'role',      label: 'Rol',    render: (r) => roleLabel(r.role) },
                { key: 'active',    label: 'Estado', render: (r) => r.active ? '<span class="badge green">Activo</span>' : '<span class="badge gray">Inactivo</span>' },
                { key: 'createdAt', label: 'Creado', render: (r) => new Date(r.createdAt).toLocaleDateString('es-CO') },
                { key: 'acc', label: '', render: (r) => {
                  const self = r.id === me.id;
                  return `<button class="btn-icon" data-edit="${r.id}" title="Editar">${U.icon('pencil')}</button>${self ? '' : `<button class="btn-icon" data-del="${r.id}" title="Eliminar">${U.icon('trash-2')}</button>`}`;
                }},
              ],
              users,
              { empty: 'No hay usuarios registrados.' }
            )}
          </div>
        </div>`;

      document.getElementById('btnNew').onclick = () => openForm();
      view.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(users.find((u) => u.id == b.dataset.edit)));
      view.querySelectorAll('[data-del]').forEach((b)  => b.onclick = () => remove(b.dataset.del));

      U.initIcons(view);
    }

    function openForm(u = null) {
      const isEdit = !!u;
      const isSelf = u && u.id === me.id;
      const box = U.modal({
        title: isEdit ? `Editar usuario · ${u.username}` : 'Nuevo usuario',
        bodyHtml: `
          <div class="grid-2">
            <div class="field"><label>Usuario *</label>
              <input id="u_username" value="${U.escapeHtml(u?.username || '')}" ${isEdit ? 'disabled' : ''} placeholder="sin espacios" /></div>
            <div class="field"><label>Nombre completo *</label>
              <input id="u_name" value="${U.escapeHtml(u?.name || '')}" /></div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Rol</label>
              <select id="u_role" ${isSelf ? 'disabled' : ''}>
                <option value="OPERADOR" ${u?.role === 'OPERADOR' || !u ? 'selected' : ''}>Operador</option>
                <option value="ADMIN"    ${u?.role === 'ADMIN' ? 'selected' : ''}>Administrador</option>
              </select>
              ${isSelf ? '<span class="hint">No puedes cambiar tu propio rol.</span>' : ''}</div>
            <div class="field"><label>Estado</label>
              <select id="u_active" ${isSelf ? 'disabled' : ''}>
                <option value="true"  ${!u || u.active  ? 'selected' : ''}>Activo</option>
                <option value="false" ${u && !u.active  ? 'selected' : ''}>Inactivo</option>
              </select></div>
          </div>
          <div class="field"><label>${isEdit ? 'Nueva contraseña' : 'Contraseña *'} <span class="hint">${isEdit ? '(dejar en blanco para no cambiar)' : 'mínimo 6 caracteres'}</span></label>
            <input id="u_pass" type="password" placeholder="••••••••" /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" id="u_save">Guardar</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('#u_save').onclick = async () => {
        const data = {
          name:   box.querySelector('#u_name').value.trim(),
          role:   isSelf ? u.role : box.querySelector('#u_role').value,
          active: isSelf ? u.active : box.querySelector('#u_active').value === 'true',
        };
        const pass = box.querySelector('#u_pass').value;
        if (pass) data.password = pass;
        if (!isEdit) {
          data.username = box.querySelector('#u_username').value.trim();
          if (!pass) return U.toast('La contraseña es obligatoria para usuarios nuevos.', 'error');
        }
        if (!data.name) return U.toast('El nombre es obligatorio.', 'error');
        try {
          if (isEdit) await API.put('/users/' + u.id, data);
          else await API.post('/users', data);
          U.closeModal(); U.toast('Usuario guardado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function remove(id) {
      if (!(await U.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.', { danger: true, okText: 'Eliminar' }))) return;
      try { await API.del('/users/' + id); U.toast('Usuario eliminado.', 'success'); load(); }
      catch (e) { U.toast(e.message, 'error'); }
    }

    await load();
  },
};
