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
                  <button class="btn-icon" data-delcat="${c.id}" title="Eliminar categoría">${U.icon('trash-2')}</button>
                </div>
                <div class="sub" style="margin:6px 0">${c._count.products} producto(s)</div>
                <div>
                  ${c.subcategories.map((s) => `<span class="badge gray" style="margin:2px 4px 2px 0">${U.escapeHtml(s.name)} <a href="#" data-delsub="${s.id}" class="badge-del" title="Eliminar subcategoría">${U.icon('x', 'icon-xs')}</a></span>`).join('') || '<span class="text-muted">Sin subcategorías</span>'}
                </div>
                <button class="btn sm ghost mt" data-addsub="${c.id}">+ Subcategoría</button>
              </div>`).join('')}
            </div>
          </div>
        </div>`;

      document.getElementById('btnCat').onclick = addCategory;
      view.querySelectorAll('[data-delcat]').forEach((b) => (b.onclick = () => delCategory(b.dataset.delcat)));
      view.querySelectorAll('[data-addsub]').forEach((b) => (b.onclick = () => addSub(b.dataset.addsub)));
      view.querySelectorAll('[data-delsub]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); delSub(b.dataset.delsub); }));
    }

    function addCategory() {
      const box = U.modal({
        title: 'Nueva categoría',
        bodyHtml: `<div class="field"><label>Nombre</label><input id="c_name" placeholder="Ej: Bebidas" /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>Crear</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        try { await API.post('/categories', { name: box.querySelector('#c_name').value }); U.closeModal(); U.toast('Categoría creada.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    function addSub(catId) {
      const box = U.modal({
        title: 'Nueva subcategoría',
        bodyHtml: `<div class="field"><label>Nombre</label><input id="s_name" placeholder="Ej: Gaseosas" /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>Crear</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        try { await API.post(`/categories/${catId}/subcategories`, { name: box.querySelector('#s_name').value }); U.closeModal(); U.toast('Subcategoría creada.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function delCategory(id) {
      if (!(await U.confirm('¿Eliminar esta categoría?', { danger: true, okText: 'Eliminar' }))) return;
      try { await API.del('/categories/' + id); U.toast('Categoría eliminada.', 'success'); load(); }
      catch (e) { U.toast(e.message, 'error'); }
    }

    async function delSub(id) {
      try { await API.del('/categories/subcategories/' + id); U.toast('Subcategoría eliminada.', 'success'); load(); }
      catch (e) { U.toast(e.message, 'error'); }
    }

    await load();
  },
};
