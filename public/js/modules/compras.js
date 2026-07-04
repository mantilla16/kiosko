/* Módulo: Compras (entradas de mercancía) */
window.Routes = window.Routes || {};
window.Routes.compras = {
  title: 'Compras',
  async render(view) {
    let products = [];

    async function load() {
      view.innerHTML = '<div class="loader">Cargando compras…</div>';
      const [purchases, prods] = await Promise.all([API.get('/purchases'), API.get('/products', { active: 'true' })]);
      products = prods;
      paint(purchases);
    }

    function paint(purchases) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Registro de compras</h2>
            <button class="btn primary" id="btnNew">+ Registrar compra</button></div>
          <div class="panel-body flush">
            ${U.table(
              [
                { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
                { key: 'prod', label: 'Producto', render: (r) => U.escapeHtml(r.product.name) },
                { key: 'quantity', label: 'Cantidad', num: true },
                { key: 'unitCost', label: 'V. Unitario', num: true, render: (r) => U.money(r.unitCost) },
                { key: 'total', label: 'V. Total', num: true, render: (r) => U.money(r.total) },
                { key: 'supplier', label: 'Proveedor', render: (r) => U.escapeHtml(r.supplier || '—') },
              ],
              purchases,
              { empty: 'Aún no hay compras registradas.' }
            )}
          </div>
        </div>`;
      document.getElementById('btnNew').onclick = openForm;
    }

    function openForm() {
      if (!products.length) { U.toast('Primero crea productos.', 'error'); return; }
      const opts = products.map((p) => `<option value="${p.id}" data-cost="${p.cost}" data-supplier="${U.escapeHtml(p.supplier || '')}">${U.escapeHtml(p.code)} · ${U.escapeHtml(p.name)}</option>`).join('');
      const box = U.modal({
        title: 'Registrar compra',
        bodyHtml: `
          <div class="field"><label>Fecha</label><input id="p_date" type="date" value="${U.today()}" /></div>
          <div class="field"><label>Producto</label><select id="p_prod">${opts}</select></div>
          <div class="grid-2">
            <div class="field"><label>Cantidad</label><input id="p_qty" type="number" min="1" value="1" /></div>
            <div class="field"><label>Valor unitario de compra</label><input id="p_cost" type="number" min="0" value="0" /></div>
          </div>
          <div class="field"><label>Proveedor</label><input id="p_supplier" /></div>
          <div class="field"><label>Valor total</label><input id="p_total" disabled /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>Guardar (suma al inventario)</button>`,
      });

      const prodSel = box.querySelector('#p_prod');
      const qty = box.querySelector('#p_qty');
      const cost = box.querySelector('#p_cost');
      const total = box.querySelector('#p_total');
      const supplier = box.querySelector('#p_supplier');

      const syncFromProduct = () => {
        const opt = prodSel.selectedOptions[0];
        cost.value = opt.dataset.cost || 0;
        supplier.value = opt.dataset.supplier || '';
        calc();
      };
      const calc = () => { total.value = U.money((Number(qty.value) || 0) * (Number(cost.value) || 0)); };
      prodSel.onchange = syncFromProduct;
      qty.oninput = calc; cost.oninput = calc;
      syncFromProduct();

      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        try {
          await API.post('/purchases', {
            productId: prodSel.value, quantity: qty.value, unitCost: cost.value,
            supplier: supplier.value, date: box.querySelector('#p_date').value,
          });
          U.closeModal(); U.toast('Compra registrada. Inventario actualizado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    await load();
  },
};
