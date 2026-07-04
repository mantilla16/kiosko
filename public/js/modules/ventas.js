/* Módulo: Ventas (contado y crédito) */
window.Routes = window.Routes || {};
window.Routes.ventas = {
  title: 'Ventas',
  async render(view) {
    let products = [];

    async function load() {
      view.innerHTML = '<div class="loader">Cargando ventas…</div>';
      const [sales, prods] = await Promise.all([API.get('/sales'), API.get('/products', { active: 'true' })]);
      products = prods;
      paint(sales);
    }

    function paint(sales) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Registro de ventas</h2>
            <button class="btn primary" id="btnNew">+ Nueva venta</button></div>
          <div class="panel-body flush">
            ${U.table(
              [
                { key: 'date',    label: 'Fecha',     render: (r) => U.date(r.date) },
                { key: 'prod',    label: 'Productos', render: (r) => U.escapeHtml(r.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')) },
                { key: 'type',    label: 'Tipo',      render: (r) => r.type === 'CREDIT' ? '<span class="badge amber">Crédito</span>' : '<span class="badge green">Contado</span>' },
                { key: 'cliente', label: 'Cliente',   render: (r) => U.escapeHtml(r.customer ? r.customer.name : '—') },
                { key: 'total',   label: 'Total',     num: true, render: (r) => U.money(r.total) },
              ],
              sales,
              { empty: 'Aún no hay ventas registradas.' }
            )}
          </div>
        </div>`;
      document.getElementById('btnNew').onclick = openForm;
    }

    function openForm() {
      if (!products.length) { U.toast('Primero crea productos con stock.', 'error'); return; }
      const cart = [];
      const opts = products.map((p) => `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">${U.escapeHtml(p.code)} · ${U.escapeHtml(p.name)} (stock ${p.stock})</option>`).join('');
      const box = U.modal({
        title: 'Nueva venta',
        wide: true,
        bodyHtml: `
          <div class="grid-2">
            <div class="field"><label>Fecha</label><input id="v_date" type="date" value="${U.today()}" /></div>
            <div class="field"><label>Tipo de venta</label><select id="v_type"><option value="CASH">Contado</option><option value="CREDIT">Crédito</option></select></div>
          </div>
          <div id="creditFields" hidden>
            <div class="grid-2">
              <div class="field"><label>Cliente</label><input id="v_customer" placeholder="Nombre del cliente" /></div>
              <div class="field"><label>Fecha límite de pago</label><input id="v_due" type="date" /></div>
            </div>
          </div>
          <p class="section-title">Productos</p>
          <div class="grid-3" style="align-items:end">
            <div class="field" style="margin:0"><label>Producto</label><select id="v_prod">${opts}</select></div>
            <div class="field" style="margin:0"><label>Cantidad</label><input id="v_qty" type="number" min="1" value="1" /></div>
            <button class="btn primary" id="v_add" style="height:38px">+ Agregar</button>
          </div>
          <div id="cart" class="mt"></div>
          <div class="right mt"><strong style="font-size:18px">Total: <span id="v_total">$0</span></strong></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn success" data-s>Registrar venta (descuenta stock)</button>`,
      });

      const typeSel = box.querySelector('#v_type');
      typeSel.onchange = () => { box.querySelector('#creditFields').hidden = typeSel.value !== 'CREDIT'; };

      const renderCart = () => {
        const cartEl = box.querySelector('#cart');
        if (!cart.length) { cartEl.innerHTML = '<div class="empty">Agrega productos a la venta.</div>'; box.querySelector('#v_total').textContent = '$0'; return; }
        let total = 0;
        cartEl.innerHTML = `<div class="table-wrap"><table class="line-items"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">P. Unit</th><th class="num">Total</th><th></th></tr></thead><tbody>${cart.map((it, i) => {
          const lineTotal = it.qty * it.price; total += lineTotal;
          return `<tr><td>${U.escapeHtml(it.name)}</td><td class="num">${it.qty}</td><td class="num">${U.money(it.price)}</td><td class="num">${U.money(lineTotal)}</td><td><button class="btn-icon" data-rm="${i}">${U.icon('x')}</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
        box.querySelector('#v_total').textContent = U.money(total);
        cartEl.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { cart.splice(Number(b.dataset.rm), 1); renderCart(); U.initIcons(cartEl); }));
        U.initIcons(cartEl);
      };

      box.querySelector('#v_add').onclick = () => {
        const sel = box.querySelector('#v_prod');
        const opt = sel.selectedOptions[0];
        const id  = Number(sel.value);
        const qty = Number(box.querySelector('#v_qty').value);
        const stock = Number(opt.dataset.stock);
        if (qty <= 0) return U.toast('Cantidad inválida.', 'error');
        const already = cart.filter((c) => c.productId === id).reduce((a, c) => a + c.qty, 0);
        if (already + qty > stock) return U.toast(`Stock insuficiente (disponible ${stock}).`, 'error');
        const existing = cart.find((c) => c.productId === id);
        if (existing) existing.qty += qty;
        else cart.push({ productId: id, name: opt.textContent.split(' (stock')[0], qty, price: Number(opt.dataset.price) });
        renderCart();
      };
      renderCart();

      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        if (!cart.length) return U.toast('Agrega al menos un producto.', 'error');
        const type    = typeSel.value;
        const payload = { type, date: box.querySelector('#v_date').value, items: cart.map((c) => ({ productId: c.productId, quantity: c.qty, unitPrice: c.price })) };
        if (type === 'CREDIT') {
          payload.customer = box.querySelector('#v_customer').value;
          payload.dueDate  = box.querySelector('#v_due').value || null;
          if (!payload.customer.trim()) return U.toast('Ingresa el cliente para el crédito.', 'error');
        }
        try { await API.post('/sales', payload); U.closeModal(); U.toast('Venta registrada. Stock actualizado.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    await load();
  },
};
