/* Módulo: Control de Inventario (entradas, salidas, existencia en tiempo real) */
window.Routes = window.Routes || {};
window.Routes.inventario = {
  title: 'Control de Inventario',
  async render(view) {
    view.innerHTML = '<div class="loader">Cargando inventario…</div>';
    const rows = await API.get('/reports/inventory');

    view.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Existencias en tiempo real</h2>
          <span class="text-muted">Existencia = Entradas − Salidas</span></div>
        <div class="panel-body">
          <div class="toolbar"><input class="search" id="search" placeholder="Buscar producto…" /></div>
          <div id="tbl"></div>
        </div>
      </div>`;

    const paint = (data) => {
      document.getElementById('tbl').innerHTML = U.table(
        [
          { key: 'code', label: 'Código' },
          { key: 'name', label: 'Producto' },
          { key: 'category', label: 'Categoría', render: (r) => U.escapeHtml(r.category || '—') },
          { key: 'entradas', label: 'Entradas', num: true, render: (r) => `<span class="text-green">${r.entradas}</span>` },
          { key: 'salidas', label: 'Salidas', num: true, render: (r) => `<span class="text-red">${r.salidas}</span>` },
          { key: 'existencia', label: 'Existencia', num: true, render: (r) => `<strong>${r.existencia}</strong>` },
          { key: 'estado', label: 'Estado', render: (r) => r.existencia <= r.minStock ? '<span class="badge red">Por agotarse</span>' : '<span class="badge green">OK</span>' },
        ],
        data,
        { empty: 'Sin productos.' }
      );
    };
    paint(rows);

    document.getElementById('search').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      paint(rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)));
    };
  },
};
