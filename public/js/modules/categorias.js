/* Módulo: Categorías y subcategorías */
window.Routes = window.Routes || {};
window.Routes.categorias = {
  title: 'Categorías',
  async render(view) {
    async function load() {
      view.innerHTML = '<div class="loader">Cargando categorías…</div>';
      const cats = await API.get('/categories');
      paint(cats);
    }

    function paint(cats) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Categorías de productos</h2>
            <button class="btn primary" id="btnCat">+ Nueva categoría</button></div>
          <div class="panel-body">
            ${cats.length === 0 ? '<div class="empty">Aún no hay categorías.</div>' : ''}
            <div class="cards">
            ${cats.map((c) => `
              <div class="kpi">
                <div class="row-flex" style="justify-content:space-between">
                  <strong style="font-size:16px">${U.escapeHtml(c.name)}</strong>
                  <span class="row-flex" style="gap:2px">
                    <button class="btn-icon" data-editcat="${c.id}" title="Renombrar categoría">${U.icon('pencil')}</button>
                    <button class="btn-icon" data-delcat="${c.id}" title="Eliminar categoría">${U.icon('trash-2')}</button>
                  </span>
                </div>
                <div class="sub" style="margin:6px 0">${c._count.products} producto(s)</div>
                <div>
                  ${c.subcategories.map((s) => `<span class="badge gray" style="margin:2px 4px 2px 0">${U.escapeHtml(s.name)}
                    <a href="#" data-editsub="${s.id}" data-subname="${U.escapeHtml(s.name)}" class="badge-del" title="Renombrar">${U.icon('pencil', 'icon-xs')}</a>
                    <a href="#" data-delsub="${s.id}" class="badge-del" title="Eliminar">${U.icon('x', 'icon-xs')}</a></span>`).join('') || '<span class="text-muted">Sin subcategorías</span>'}
                </div>
                <button class="btn sm ghost mt" data-addsub="${c.id}">+ Subcategoría</button>
              </div>`).join('')}
            </div>
          </div>
        </div>`;

      document.getElementById('btnCat').onclick = addCategory;
      view.querySelectorAll('[data-editcat]').forEach((b) => (b.onclick = () => editCategory(b.dataset.editcat)));
      view.querySelectorAll('[data-delcat]').forEach((b) => (b.onclick = () => delCategory(b.dataset.delcat)));
      view.querySelectorAll('[data-addsub]').forEach((b) => (b.onclick = () => addSub(b.dataset.addsub)));
      view.querySelectorAll('[data-editsub]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); editSub(b.dataset.editsub, b.dataset.subname); }));
      view.querySelectorAll('[data-delsub]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); delSub(b.dataset.delsub); }));

      // Reinicializar los iconos de Lucide tras cada render (si no, quedan invisibles al recargar).
      U.initIcons(view);
    }

    // Modal genérico de un solo campo de texto.
    function nameModal({ title, value = '', placeholder = '', okText = 'Guardar' }, onSave) {
      const box = U.modal({
        title,
        bodyHtml: `<div class="field"><label>Nombre</label><input id="n_name" value="${U.escapeHtml(value)}" placeholder="${U.escapeHtml(placeholder)}" /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>${U.escapeHtml(okText)}</button>`,
      });
      const input = box.querySelector('#n_name');
      input.focus();
      box.querySelector('[data-c]').onclick = U.closeModal;
      const save = async () => {
        const name = input.value.trim();
        if (!name) return U.toast('Escribe un nombre.', 'error');
        try { await onSave(name); U.closeModal(); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
      box.querySelector('[data-s]').onclick = save;
      input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    }

    function addCategory() {
      nameModal({ title: 'Nueva categoría', placeholder: 'Ej: Bebidas', okText: 'Crear' },
        async (name) => { await API.post('/categories', { name }); U.toast('Categoría creada.', 'success'); });
    }

    function editCategory(id) {
      const btn = view.querySelector(`[data-editcat="${id}"]`);
      const current = btn.closest('.kpi').querySelector('strong').textContent;
      nameModal({ title: 'Renombrar categoría', value: current, okText: 'Guardar' },
        async (name) => { await API.put('/categories/' + id, { name }); U.toast('Categoría actualizada.', 'success'); });
    }

    function addSub(catId) {
      nameModal({ title: 'Nueva subcategoría', placeholder: 'Ej: Gaseosas', okText: 'Crear' },
        async (name) => { await API.post(`/categories/${catId}/subcategories`, { name }); U.toast('Subcategoría creada.', 'success'); });
    }

    function editSub(id, currentName) {
      nameModal({ title: 'Renombrar subcategoría', value: currentName, okText: 'Guardar' },
        async (name) => { await API.put('/categories/subcategories/' + id, { name }); U.toast('Subcategoría actualizada.', 'success'); });
    }

    async function delCategory(id) {
      if (!(await U.confirm('¿Eliminar esta categoría?', { danger: true, okText: 'Eliminar' }))) return;
      try { await API.del('/categories/' + id); U.toast('Categoría eliminada.', 'success'); load(); }
      catch (e) { U.toast(e.message, 'error'); }
    }

    async function delSub(id) {
      if (!(await U.confirm('¿Eliminar esta subcategoría?', { danger: true, okText: 'Eliminar' }))) return;
      try { await API.del('/categories/subcategories/' + id); U.toast('Subcategoría eliminada.', 'success'); load(); }
      catch (e) { U.toast(e.message, 'error'); }
    }

    await load();
  },
};
