/* Módulo: Inventario Físico (conteos y ajustes) */
window.Routes = window.Routes || {};
window.Routes.fisico = {
  title: 'Inventario Físico',
  async render(view) {
    let products = [];
    let categories = [];

    async function load() {
      view.innerHTML = '<div class="loader">Cargando inventarios físicos…</div>';
      const [list, prods, cats] = await Promise.all([
        API.get('/physical-inventory'),
        API.get('/products', { active: 'true' }),
        API.get('/categories'),
      ]);
      products = prods; categories = cats;
      paint(list);
    }

    function paint(list) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Conteos físicos de inventario</h2>
            <button class="btn primary" id="btnNew">+ Nuevo conteo</button></div>
          <div class="panel-body flush">
            ${U.table(
              [
                { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
                { key: 'note', label: 'Observación', render: (r) => U.escapeHtml(r.note || '—') },
                { key: 'items', label: 'Productos', num: true, render: (r) => r.items.length },
                { key: 'diff', label: 'Con diferencia', num: true, render: (r) => r.items.filter((i) => i.difference !== 0).length },
                { key: 'status', label: 'Estado', render: (r) => r.status === 'APPROVED' ? '<span class="badge green">Aprobado</span>' : '<span class="badge amber">Borrador</span>' },
                { key: 'acc', label: '', render: (r) => `<button class="btn sm" data-view="${r.id}">Ver</button>` },
              ],
              list,
              { empty: 'Aún no se han realizado conteos físicos.' }
            )}
          </div>
        </div>`;
      document.getElementById('btnNew').onclick = openForm;
      view.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => viewDetail(b.dataset.view)));
    }

    function openForm() {
      const catOpts = categories.map((c) => `<option value="${c.id}">${U.escapeHtml(c.name)}</option>`).join('');
      const box = U.modal({
        title: 'Nuevo conteo físico',
        wide: true,
        bodyHtml: `
          <div class="field"><label>Observación</label><input id="i_note" placeholder="Ej: Conteo mensual junio" /></div>
          <div class="field"><label>Alcance</label>
            <select id="i_scope"><option value="general">Inventario general (todos los productos)</option><option value="cat">Por categoría</option></select></div>
          <div class="field" id="catWrap" hidden><label>Categoría</label><select id="i_cat">${catOpts}</select></div>
          <p class="section-title">Conteo físico</p>
          <div id="countTable"></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>Guardar conteo</button>`,
      });

      const scope = box.querySelector('#i_scope');
      const catWrap = box.querySelector('#catWrap');
      const buildTable = () => {
        let list = products;
        if (scope.value === 'cat') {
          const cid = Number(box.querySelector('#i_cat').value);
          list = products.filter((p) => p.categoryId === cid);
        }
        box.querySelector('#countTable').innerHTML = `<div class="table-wrap"><table class="line-items"><thead><tr><th>Producto</th><th class="num">Sistema</th><th class="num">Físico</th><th>Observación</th></tr></thead><tbody>
          ${list.map((p) => `<tr data-pid="${p.id}"><td>${U.escapeHtml(p.name)}</td><td class="num">${p.stock}</td><td><input class="input-sm" type="number" min="0" value="${p.stock}" data-phys style="width:90px" /></td><td><input class="input-sm" data-obs placeholder="—" /></td></tr>`).join('')}
        </tbody></table></div>`;
      };
      scope.onchange = () => { catWrap.hidden = scope.value !== 'cat'; buildTable(); };
      box.querySelector('#i_cat').onchange = buildTable;
      buildTable();

      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        const items = [...box.querySelectorAll('tr[data-pid]')].map((tr) => ({
          productId: Number(tr.dataset.pid),
          physicalQty: Number(tr.querySelector('[data-phys]').value),
          observation: tr.querySelector('[data-obs]').value || null,
        }));
        try { await API.post('/physical-inventory', { note: box.querySelector('#i_note').value, items }); U.closeModal(); U.toast('Conteo guardado.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function viewDetail(id) {
      const inv = await API.get('/physical-inventory/' + id);
      const box = U.modal({
        title: `Conteo físico #${inv.id} · ${U.date(inv.date)}`,
        wide: true,
        bodyHtml: `
          <p class="text-muted">${U.escapeHtml(inv.note || '')} ${inv.status === 'APPROVED' ? '<span class="badge green">Aprobado</span>' : '<span class="badge amber">Borrador</span>'}</p>
          ${U.table(
            [
              { key: 'prod', label: 'Producto', render: (r) => U.escapeHtml(r.product.name) },
              { key: 'systemQty', label: 'Sistema', num: true },
              { key: 'physicalQty', label: 'Físico', num: true },
              { key: 'difference', label: 'Diferencia', num: true, render: (r) => r.difference === 0 ? '0' : `<span class="${r.difference > 0 ? 'text-green' : 'text-red'}">${r.difference > 0 ? '+' : ''}${r.difference}</span>` },
              { key: 'observation', label: 'Observación', render: (r) => U.escapeHtml(r.observation || '—') },
            ],
            inv.items
          )}`,
        footerHtml: inv.status === 'APPROVED'
          ? `<button class="btn" data-c>Cerrar</button>`
          : `<button class="btn" data-c>Cerrar</button><button class="btn success" data-approve>Aprobar y generar ajustes</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      const ap = box.querySelector('[data-approve]');
      if (ap) ap.onclick = async () => {
        if (!(await U.confirm('Al aprobar, el stock se ajustará al conteo físico y se registrará en el kardex. ¿Continuar?'))) return;
        try { await API.post(`/physical-inventory/${id}/approve`); U.closeModal(); U.toast('Inventario aprobado. Ajustes aplicados.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    await load();
  },
};
