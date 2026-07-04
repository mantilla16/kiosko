/* Módulo: Reportes (inventario actual, por agotarse, utilidad, ventas por día) */
window.Routes = window.Routes || {};
window.Routes.reportes = {
  title: 'Reportes',
  async render(view) {
    let current = 'inventario';
    const filtros = { from: '', to: '' };
    // Datos del reporte actualmente mostrado, para exportar/imprimir.
    let exportData = { title: '', headers: [], rows: [] };

    view.innerHTML = `
      <div class="toolbar">
        <button class="btn" data-tab="inventario">Inventario actual</button>
        <button class="btn" data-tab="agotarse">Por agotarse</button>
        <button class="btn" data-tab="utilidad">Utilidad</button>
        <button class="btn" data-tab="ventas">Ventas por día</button>
        <span style="flex:1"></span>
        <button class="btn" id="btnCsv" title="Descargar en Excel">${U.icon('file-spreadsheet')} Excel</button>
        <button class="btn" id="btnPdf" title="Imprimir o guardar como PDF">${U.icon('printer')} Imprimir / PDF</button>
      </div>
      <div id="report"></div>`;

    const tabs = view.querySelectorAll('[data-tab]');
    const setActive = () => tabs.forEach((t) => t.classList.toggle('primary', t.dataset.tab === current));
    tabs.forEach((t) => (t.onclick = () => { current = t.dataset.tab; setActive(); render(); }));

    view.querySelector('#btnCsv').onclick = () => {
      if (!exportData.rows.length) return U.toast('No hay datos para exportar.', 'info');
      U.downloadCSV(exportData.title, [exportData.headers, ...exportData.rows]);
    };
    view.querySelector('#btnPdf').onclick = () => {
      if (!exportData.rows.length) return U.toast('No hay datos para imprimir.', 'info');
      U.printTable(exportData.title, exportData.headers, exportData.rows);
    };

    async function render() {
      const box = document.getElementById('report');
      box.innerHTML = '<div class="loader">Cargando…</div>';

      if (current === 'inventario') {
        const rows = await API.get('/reports/inventory');
        exportData = {
          title: 'Inventario actual',
          headers: ['Código', 'Producto', 'Categoría', 'Unidad', 'Existencia'],
          rows: rows.map((r) => [r.code, r.name, r.category || '—', r.unit, r.existencia]),
        };
        box.innerHTML = panel('Inventario actual', U.table(
          [
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Producto' },
            { key: 'category', label: 'Categoría', render: (r) => U.escapeHtml(r.category || '—') },
            { key: 'unit', label: 'Unidad' },
            { key: 'existencia', label: 'Existencia', num: true, render: (r) => `<strong>${r.existencia}</strong>` },
          ], rows));
      }

      else if (current === 'agotarse') {
        const rows = await API.get('/reports/low-stock');
        exportData = {
          title: 'Productos por agotarse',
          headers: ['Código', 'Producto', 'Categoría', 'Stock', 'Mínimo', 'Sugerido pedir'],
          rows: rows.map((r) => [r.code, r.name, r.category || '—', r.stock, r.minStock, r.faltante || 0]),
        };
        box.innerHTML = panel('Productos por agotarse', U.table(
          [
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Producto' },
            { key: 'category', label: 'Categoría', render: (r) => U.escapeHtml(r.category || '—') },
            { key: 'stock', label: 'Stock', num: true, render: (r) => `<span class="text-red">${r.stock}</span>` },
            { key: 'minStock', label: 'Mínimo', num: true },
            { key: 'faltante', label: 'Sugerido pedir', num: true, render: (r) => r.faltante || '—' },
          ], rows, { empty: '¡Todo en orden! Ningún producto por agotarse.' }));
      }

      else if (current === 'utilidad') {
        const rows = await API.get('/reports/profit');
        const totalProfit = rows.reduce((a, r) => a + r.totalProfit, 0);
        exportData = {
          title: 'Reporte de utilidad',
          headers: ['Código', 'Producto', 'Costo', 'Precio', 'Utilidad/unid', 'Unid. vendidas', 'Utilidad total'],
          rows: rows.map((r) => [r.code, r.name, r.cost, r.price, r.unitProfit, r.soldQty, r.totalProfit]),
        };
        box.innerHTML = panel(`Reporte de utilidad · Total generado: ${U.money(totalProfit)}`, U.table(
          [
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Producto' },
            { key: 'cost', label: 'Comprado (costo)', num: true, render: (r) => U.money(r.cost) },
            { key: 'price', label: 'Vendido (precio)', num: true, render: (r) => U.money(r.price) },
            { key: 'unitProfit', label: 'Utilidad/unid', num: true, render: (r) => `<span class="${r.unitProfit >= 0 ? 'text-green' : 'text-red'}">${U.money(r.unitProfit)}</span>` },
            { key: 'soldQty', label: 'Unid. vendidas', num: true },
            { key: 'totalProfit', label: 'Utilidad total', num: true, render: (r) => `<strong class="${r.totalProfit >= 0 ? 'text-green' : 'text-red'}">${U.money(r.totalProfit)}</strong>` },
          ], rows));
      }

      else if (current === 'ventas') {
        const rows = await API.get('/reports/sales-by-day', { from: filtros.from, to: filtros.to });
        const total = rows.reduce((a, r) => a + r.total, 0);
        exportData = {
          title: 'Ventas por día',
          headers: ['Fecha', 'N° ventas', 'Total ventas'],
          rows: rows.map((r) => [U.date(r.date), r.count, r.total]),
        };
        box.innerHTML = `
          <div class="panel">
            <div class="panel-head">
              <h2>Ventas por día · Total acumulado: ${U.money(total)}</h2>
              <div class="row-flex" style="gap:8px;align-items:center">
                <label class="hint" style="margin:0">Desde</label>
                <input type="date" id="fFrom" value="${filtros.from}" />
                <label class="hint" style="margin:0">Hasta</label>
                <input type="date" id="fTo" value="${filtros.to}" />
                <button class="btn sm" id="fClear">Limpiar</button>
              </div>
            </div>
            <div class="panel-body flush">${U.table(
              [
                { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
                { key: 'count', label: 'N° ventas', num: true },
                { key: 'total', label: 'Total ventas', num: true, render: (r) => `<strong>${U.money(r.total)}</strong>` },
              ], rows, { empty: 'No hay ventas en el rango seleccionado.' })}</div>
          </div>`;

        const fromEl = document.getElementById('fFrom');
        const toEl = document.getElementById('fTo');
        fromEl.onchange = () => { filtros.from = fromEl.value; render(); };
        toEl.onchange = () => { filtros.to = toEl.value; render(); };
        document.getElementById('fClear').onclick = () => { filtros.from = ''; filtros.to = ''; render(); };
      }

      U.initIcons(view);
    }

    const panel = (title, body) => `<div class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body flush">${body}</div></div>`;

    setActive();
    await render();
  },
};
