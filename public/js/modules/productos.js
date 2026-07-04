/* Módulo: Maestro de Productos */
window.Routes = window.Routes || {};
window.Routes.productos = {
  title: 'Productos',
  async render(view) {
    let categories = [];
    const state = { q: '', categoryId: '' };

    async function load() {
      view.innerHTML = '<div class="loader">Cargando productos…</div>';
      const [products, cats] = await Promise.all([
        API.get('/products', { q: state.q, categoryId: state.categoryId }),
        API.get('/categories'),
      ]);
      categories = cats;
      paint(products);
    }

    function paint(products) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head">
            <h2>Maestro de Productos</h2>
            <button class="btn primary" id="btnNew">+ Nuevo producto</button>
          </div>
          <div class="panel-body">
            <div class="toolbar">
              <input class="search" id="search" placeholder="Buscar por nombre o código…" value="${U.escapeHtml(state.q)}" />
              <select id="catFilter" style="max-width:200px">
                <option value="">Todas las categorías</option>
                ${categories.map((c) => `<option value="${c.id}" ${state.categoryId == c.id ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            ${U.table(
              [
                { key: 'code',     label: 'Código' },
                { key: 'name',     label: 'Nombre' },
                { key: 'cat',      label: 'Categoría', render: (r) => U.escapeHtml(r.category ? r.category.name : '—') },
                { key: 'unit',     label: 'Unidad' },
                { key: 'supplier', label: 'Proveedor', render: (r) => U.escapeHtml(r.supplier || '—') },
                { key: 'cost',     label: 'Costo',   num: true, render: (r) => U.money(r.cost) },
                { key: 'price',    label: 'P. Venta',num: true, render: (r) => U.money(r.price) },
                { key: 'stock',    label: 'Stock',   num: true, render: (r) => r.stock <= r.minStock ? `<span class="text-red">${r.stock}</span>` : r.stock },
                { key: 'min',      label: 'Mín',     num: true, render: (r) => r.minStock },
                { key: 'estado',   label: 'Estado',  render: (r) => r.active ? '<span class="badge green">Activo</span>' : '<span class="badge gray">Inactivo</span>' },
                { key: 'acc', label: '', render: (r) => `
                  <button class="btn-icon" data-stock="${r.id}" title="Ajustar stock">${U.icon('package-plus')}</button>
                  <button class="btn-icon" data-edit="${r.id}"  title="Editar">${U.icon('pencil')}</button>
                  <button class="btn-icon" data-del="${r.id}"   title="Eliminar">${U.icon('trash-2')}</button>` },
              ],
              products,
              { empty: 'No hay productos. Crea el primero con "Nuevo producto".' }
            )}
          </div>
        </div>`;

      document.getElementById('btnNew').onclick = () => openForm();
      const search = document.getElementById('search');
      search.oninput = debounce(() => { state.q = search.value; load(); }, 350);
      document.getElementById('catFilter').onchange = (e) => { state.categoryId = e.target.value; load(); };
      view.querySelectorAll('[data-edit]').forEach((b)  => (b.onclick = () => openForm(products.find((p) => p.id == b.dataset.edit))));
      view.querySelectorAll('[data-del]').forEach((b)   => (b.onclick = () => remove(b.dataset.del)));
      view.querySelectorAll('[data-stock]').forEach((b) => (b.onclick = () => openStock(products.find((p) => p.id == b.dataset.stock))));
    }

    function openStock(p) {
      const box = U.modal({
        title: `Ajustar stock · ${p.name}`,
        bodyHtml: `
          <p class="text-muted">Stock actual: <strong>${p.stock}</strong> ${U.escapeHtml(p.unit)}</p>
          <div class="grid-2">
            <div class="field"><label>Movimiento</label>
              <select id="s_type"><option value="in">Agregar (entrada)</option><option value="out">Quitar (salida)</option></select></div>
            <div class="field"><label>Cantidad</label><input id="s_qty" type="number" min="1" value="1" /></div>
          </div>
          <div class="field"><label>Motivo <span class="hint">(opcional)</span></label><input id="s_reason" placeholder="Ej: Producto dañado, ajuste manual…" /></div>
          <p class="text-muted">Nuevo stock: <strong id="s_preview">${p.stock}</strong></p>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>Aplicar ajuste</button>`,
      });
      const typeSel  = box.querySelector('#s_type');
      const qtyInput = box.querySelector('#s_qty');
      const preview  = box.querySelector('#s_preview');
      const calc = () => {
        const q = (Number(qtyInput.value) || 0) * (typeSel.value === 'out' ? -1 : 1);
        const next = p.stock + q;
        preview.textContent = next;
        preview.className = next < 0 ? 'text-red' : '';
      };
      typeSel.onchange = calc; qtyInput.oninput = calc; calc();
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        const q = (Number(qtyInput.value) || 0) * (typeSel.value === 'out' ? -1 : 1);
        if (!q) return U.toast('Ingresa una cantidad válida.', 'error');
        try {
          await API.post(`/products/${p.id}/stock-adjustment`, { quantity: q, reason: box.querySelector('#s_reason').value });
          U.closeModal(); U.toast('Stock ajustado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    function openForm(p = null) {
      const isEdit = !!p;
      const catOptions = categories.map((c) => `<option value="${c.id}" ${p && p.categoryId == c.id ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('');
      const subOptions = (catId) => {
        const cat = categories.find((c) => c.id == catId);
        if (!cat) return '';
        return cat.subcategories.map((s) => `<option value="${s.id}" ${p && p.subcategoryId == s.id ? 'selected' : ''}>${U.escapeHtml(s.name)}</option>`).join('');
      };
      const box = U.modal({
        title: isEdit ? 'Editar producto' : 'Nuevo producto',
        wide: true,
        bodyHtml: `
          <div class="grid-2">
            <div class="field"><label>Código *</label><input id="f_code" value="${U.escapeHtml(p?.code || '')}" /></div>
            <div class="field"><label>Nombre *</label><input id="f_name" value="${U.escapeHtml(p?.name || '')}" /></div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Categoría</label><select id="f_cat"><option value="">—</option>${catOptions}</select></div>
            <div class="field"><label>Subcategoría</label><select id="f_sub"><option value="">—</option>${p ? subOptions(p.categoryId) : ''}</select></div>
          </div>
          <div class="grid-3">
            <div class="field"><label>Unidad de medida</label><input id="f_unit" value="${U.escapeHtml(p?.unit || 'Unidad')}" /></div>
            <div class="field"><label>Proveedor</label><input id="f_supplier" value="${U.escapeHtml(p?.supplier || '')}" /></div>
            <div class="field"><label>Estado</label><select id="f_active"><option value="true" ${!p || p.active ? 'selected' : ''}>Activo</option><option value="false" ${p && !p.active ? 'selected' : ''}>Inactivo</option></select></div>
          </div>
          <div class="grid-3">
            <div class="field"><label>Costo de compra</label><input id="f_cost" type="number" min="0" value="${p?.cost ?? 0}" /></div>
            <div class="field"><label>Precio de venta</label><input id="f_price" type="number" min="0" value="${p?.price ?? 0}" /></div>
            <div class="field"><label>Stock mínimo</label><input id="f_min" type="number" min="0" value="${p?.minStock ?? 0}" /></div>
          </div>
          ${isEdit ? '' : `<div class="field"><label>Stock inicial</label><input id="f_stock" type="number" min="0" value="0" /><span class="hint">Las compras y ventas ajustarán el stock automáticamente.</span></div>`}`,
        footerHtml: `<button class="btn" data-close-2>Cancelar</button><button class="btn primary" id="f_save">Guardar</button>`,
      });
      box.querySelector('[data-close-2]').onclick = U.closeModal;
      box.querySelector('#f_cat').onchange = (e) => { box.querySelector('#f_sub').innerHTML = '<option value="">—</option>' + subOptions(e.target.value); };
      box.querySelector('#f_save').onclick = async () => {
        const data = {
          code: box.querySelector('#f_code').value, name: box.querySelector('#f_name').value,
          categoryId: box.querySelector('#f_cat').value || null, subcategoryId: box.querySelector('#f_sub').value || null,
          unit: box.querySelector('#f_unit').value, supplier: box.querySelector('#f_supplier').value,
          cost: box.querySelector('#f_cost').value, price: box.querySelector('#f_price').value,
          minStock: box.querySelector('#f_min').value, active: box.querySelector('#f_active').value === 'true',
        };
        if (!isEdit) data.stock = box.querySelector('#f_stock').value;
        try {
          if (isEdit) await API.put('/products/' + p.id, data);
          else await API.post('/products', data);
          U.closeModal(); U.toast('Producto guardado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function remove(id) {
      if (!(await U.confirm('¿Eliminar este producto?', { danger: true, okText: 'Eliminar' }))) return;
      try {
        await API.del('/products/' + id);
        U.toast('Producto eliminado.', 'success'); load();
      } catch (e) {
        if (/movimientos/i.test(e.message)) {
          const ok = await U.confirm(
            'Este producto tiene historial (movimientos, compras o ventas). Si lo eliminas, también se borrará TODO ese historial. ¿Eliminar definitivamente?',
            { danger: true, okText: 'Eliminar todo' }
          );
          if (!ok) return;
          try {
            await API.del('/products/' + id + '?force=true');
            U.toast('Producto y su historial eliminados.', 'success'); load();
          } catch (e2) { U.toast(e2.message, 'error'); }
        } else { U.toast(e.message, 'error'); }
      }
    }

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

    await load();
  },
};
