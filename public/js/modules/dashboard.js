/* Módulo: Panel principal (dashboard) */
window.Routes = window.Routes || {};
window.Routes.dashboard = {
  title: 'Panel',
  async render(view) {
    view.innerHTML = '<div class="loader">Cargando panel…</div>';
    const d = await API.get('/reports/dashboard');

    const kpis = [
      { icon: 'banknote',       label: 'Ventas de hoy',            value: U.money(d.todaySalesTotal),    sub: `Contado ${U.money(d.todaySalesCash || 0)} · Crédito ${U.money(d.todaySalesCredit || 0)}`, accent: 'green' },
      { icon: 'wallet',         label: 'Por cobrar (cartera)',      value: U.money(d.receivable),         sub: `${d.customers} cliente(s)`,         accent: 'red' },
      { icon: 'alert-triangle', label: 'Productos por agotarse',    value: d.lowStockCount,               sub: 'en o bajo el mínimo',               accent: 'amber' },
      { icon: 'package',        label: 'Productos activos',         value: d.activeProducts,              sub: `${d.totalProducts} en total`,       accent: 'blue' },
      { icon: 'box',            label: 'Valor inventario (costo)',  value: U.money(d.inventoryValueCost), sub: 'capital en mercancía' },
      { icon: 'tag',            label: 'Valor inventario (venta)',  value: U.money(d.inventoryValuePrice),sub: 'si se vende todo' },
    ];

    view.innerHTML = `
      <div class="cards">
        ${kpis.map((k) => `
          <div class="kpi with-icon ${k.accent ? 'accent-' + k.accent : ''}">
            <div class="kpi-icon">${U.icon(k.icon)}</div>
            <div class="kpi-body">
              <div class="label">${k.label}</div>
              <div class="value">${k.value}</div>
              <div class="sub">${k.sub}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Productos por agotarse</h2>
          <a class="btn sm" href="#/reportes">Ver reporte completo</a>
        </div>
        <div class="panel-body flush">
          ${U.table(
            [
              { key: 'code',     label: 'Código' },
              { key: 'name',     label: 'Producto' },
              { key: 'category', label: 'Categoría', render: (r) => U.escapeHtml(r.category || '—') },
              { key: 'stock',    label: 'Stock',   num: true, render: (r) => `<span class="text-red">${r.stock}</span>` },
              { key: 'minStock', label: 'Mínimo',  num: true },
            ],
            d.lowStockList,
            { empty: 'Ningún producto por agotarse.' }
          )}
        </div>
      </div>`;
  },
};
