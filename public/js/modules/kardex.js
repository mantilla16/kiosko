/* Módulo: Kardex por producto (historial de movimientos con saldo) */
window.Routes = window.Routes || {};
window.Routes.kardex = {
  title: 'Kardex',
  async render(view) {
    const products = await API.get('/products');
    const typeLabel = { INITIAL: 'Saldo inicial', PURCHASE: 'Compra', SALE: 'Venta', ADJUSTMENT: 'Ajuste' };

    view.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Kardex por producto</h2></div>
        <div class="panel-body">
          <div class="field" style="max-width:420px"><label>Seleccione un producto</label>
            <select id="prod"><option value="">— Elegir —</option>${products.map((p) => `<option value="${p.id}">${U.escapeHtml(p.code)} · ${U.escapeHtml(p.name)}</option>`).join('')}</select></div>
          <div id="kx"></div>
        </div>
      </div>`;

    document.getElementById('prod').onchange = async (e) => {
      const id = e.target.value;
      const kx = document.getElementById('kx');
      if (!id) { kx.innerHTML = ''; return; }
      kx.innerHTML = '<div class="loader">Cargando movimientos…</div>';
      const data = await API.get('/reports/kardex/' + id);
      kx.innerHTML = `
        <p class="section-title">${U.escapeHtml(data.product.name)} · Saldo actual: <strong>${data.product.stock}</strong></p>
        ${U.table(
          [
            { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
            { key: 'type', label: 'Movimiento', render: (r) => typeLabel[r.type] || r.type },
            { key: 'reference', label: 'Referencia', render: (r) => U.escapeHtml(r.reference || '—') },
            { key: 'quantityIn', label: 'Entrada', num: true, render: (r) => r.quantityIn ? `<span class="text-green">${r.quantityIn}</span>` : '—' },
            { key: 'quantityOut', label: 'Salida', num: true, render: (r) => r.quantityOut ? `<span class="text-red">${r.quantityOut}</span>` : '—' },
            { key: 'balance', label: 'Saldo', num: true, render: (r) => `<strong>${r.balance}</strong>` },
          ],
          data.movements,
          { empty: 'Este producto no tiene movimientos.' }
        )}`;
    };
  },
};
