/* Módulo: Administración de Kioskos */
window.Routes = window.Routes || {};
window.Routes.kioskos = {
  title: 'Kioskos',
  async render(view) {
    async function load() {
      view.innerHTML = '<div class="loader">Cargando kioskos…</div>';
      const kiosks = await API.get('/kiosks');
      paint(kiosks);
    }

    function paint(kiosks) {
      const activeId = API.getKiosk();
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Kioskos (espacios)</h2>
            <button class="btn primary" id="btnNew">+ Nuevo kiosko</button></div>
          <div class="panel-body">
            <p class="text-muted" style="margin-bottom:14px">Cada kiosko maneja su propia información (productos, ventas, inventario y cartera) de forma totalmente independiente.</p>
            ${U.table(
              [
                { key: 'name',  label: 'Kiosko',    render: (r) => `${U.escapeHtml(r.name)} ${String(r.id) === String(activeId) ? '<span class="badge blue">Activo</span>' : ''}` },
                { key: 'prods', label: 'Productos', num: true, render: (r) => r._count.products },
                { key: 'sales', label: 'Ventas',    num: true, render: (r) => r._count.sales },
                { key: 'acc', label: '', render: (r) => `
                  ${String(r.id) === String(activeId) ? '' : `<button class="btn sm" data-use="${r.id}">Usar</button>`}
                  <button class="btn-icon" data-edit="${r.id}" title="Renombrar">${U.icon('pencil')}</button>
                  <button class="btn-icon" data-del="${r.id}"  title="Eliminar">${U.icon('trash-2')}</button>` },
              ],
              kiosks,
              { empty: 'No hay kioskos. Crea el primero.' }
            )}
          </div>
        </div>`;

      document.getElementById('btnNew').onclick = openForm;
      view.querySelectorAll('[data-use]').forEach((b) => (b.onclick = async () => {
        API.setKiosk(b.dataset.use); await window.refreshKiosks(); U.toast('Kiosko activo cambiado.', 'success'); load();
      }));
      view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => openForm(kiosks.find((k) => k.id == b.dataset.edit))));
      view.querySelectorAll('[data-del]').forEach((b)  => (b.onclick = () => remove(kiosks.find((k) => k.id == b.dataset.del))));

      U.initIcons(view);
    }

    function openForm(k = null) {
      const isEdit = !!k;
      const box = U.modal({
        title: isEdit ? 'Renombrar kiosko' : 'Nuevo kiosko',
        bodyHtml: `
          <div class="field"><label>Nombre del kiosko</label><input id="k_name" value="${U.escapeHtml(k?.name || '')}" placeholder="Ej: Kiosco Tribuna Norte" /></div>
          ${isEdit ? '' : `<label class="row-flex" style="font-weight:500"><input type="checkbox" id="k_seed" checked style="width:auto"> Crear con las categorías sugeridas</label>`}`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>${isEdit ? 'Guardar' : 'Crear'}</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        const name = box.querySelector('#k_name').value;
        try {
          if (isEdit) { await API.put('/kiosks/' + k.id, { name }); }
          else {
            const created = await API.post('/kiosks', { name, seedCategories: box.querySelector('#k_seed').checked });
            if (!API.getKiosk()) API.setKiosk(String(created.id));
          }
          U.closeModal(); await window.refreshKiosks(); U.toast(isEdit ? 'Kiosko actualizado.' : 'Kiosko creado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function remove(k) {
      const ok = await U.confirm(
        `¿Eliminar el kiosko "${k.name}"? Se borrará TODA su información (productos, ventas, inventario, cartera). Esta acción no se puede deshacer.`,
        { danger: true, okText: 'Eliminar todo' }
      );
      if (!ok) return;
      try {
        await API.del('/kiosks/' + k.id);
        if (String(API.getKiosk()) === String(k.id)) API.setKiosk('');
        await window.refreshKiosks(); U.toast('Kiosko eliminado.', 'success'); load();
      } catch (e) { U.toast(e.message, 'error'); }
    }

    await load();
  },
};
