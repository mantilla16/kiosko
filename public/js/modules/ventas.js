/* Módulo: Registro de ventas (control contable) — reemplaza Ventas en vivo e Inventario Físico.
   Por cada producto se anota la cantidad vendida de contado y a crédito. El crédito pide
   el cliente (CC único + nombre). Se guarda como borrador editable y al aprobar se generan
   las ventas, se descuenta stock y se crean los créditos (uno por cliente, número secuencial). */
window.Routes = window.Routes || {};
window.Routes.ventas = {
  title: 'Registro de ventas',
  async render(view) {
    let products = [];
    let customersByCc = {};

    async function load() {
      view.innerHTML = '<div class="loader">Cargando registros de ventas…</div>';
      const [list, prods, customers] = await Promise.all([
        API.get('/sales-records'),
        API.get('/products', { active: 'true' }),
        API.get('/credits/customers'),
      ]);
      products = prods;
      customersByCc = {};
      customers.forEach((c) => { if (c.cc) customersByCc[c.cc] = c.name; });
      paint(list);
    }

    function paint(list) {
      view.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h2>Registros de ventas</h2>
            <button class="btn primary" id="btnNew">+ Nuevo registro</button></div>
          <div class="panel-body flush">
            ${U.table(
              [
                { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
                { key: 'note', label: 'Observación', render: (r) => U.escapeHtml(r.note || '—') },
                { key: 'items', label: 'Productos', num: true, render: (r) => r.items.length },
                { key: 'cashTotal', label: 'Contado', num: true, render: (r) => `<span class="text-green">${U.money(r.cashTotal)}</span>` },
                { key: 'creditTotal', label: 'Crédito', num: true, render: (r) => `<span class="text-amber">${U.money(r.creditTotal)}</span>` },
                { key: 'total', label: 'Total', num: true, render: (r) => `<strong>${U.money(r.total)}</strong>` },
                { key: 'status', label: 'Estado', render: (r) => r.status === 'APPROVED' ? '<span class="badge green">Aprobado</span>' : '<span class="badge amber">Borrador</span>' },
                { key: 'acc', label: '', render: (r) => `<button class="btn sm" data-view="${r.id}">Ver</button>` },
              ],
              list,
              { empty: 'Aún no hay registros de ventas. Crea el primero con "Nuevo registro".' }
            )}
          </div>
        </div>`;
      document.getElementById('btnNew').onclick = () => openForm();
      view.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => viewDetail(b.dataset.view)));
      U.initIcons(view);
    }

    // Formulario de registro (nuevo o edición de borrador).
    function openForm(record = null) {
      const isEdit = !!record;
      const existing = {};
      if (record) record.items.forEach((i) => { existing[i.productId] = i; });
      const dateValue = isEdit ? new Date(record.date).toISOString().slice(0, 10) : U.today();

      const rows = products.map((p) => {
        const e = existing[p.id];
        return `<tr data-pid="${p.id}">
          <td>${U.escapeHtml(p.name)} <span class="text-muted">(${p.stock} disp.)</span></td>
          <td class="num">${U.money(p.price)}</td>
          <td><input class="input-sm cashq" type="number" min="0" value="${e ? e.cashQty : 0}" style="width:70px" /></td>
          <td><input class="input-sm creditq" type="number" min="0" value="${e ? e.creditQty : 0}" style="width:70px" /></td>
          <td>
            <div class="row-flex credit-fields" style="gap:4px;flex-wrap:wrap">
              <input class="input-sm cc" placeholder="CC cliente" value="${e && e.customerCc ? U.escapeHtml(e.customerCc) : ''}" style="width:110px" />
              <input class="input-sm cname" placeholder="Nombre" value="${e && e.customerName ? U.escapeHtml(e.customerName) : ''}" style="width:130px" />
            </div>
          </td>
        </tr>`;
      }).join('');

      const box = U.modal({
        title: isEdit ? `Editar registro #${record.id}` : 'Nuevo registro de ventas',
        wide: true,
        bodyHtml: `
          <div class="grid-2">
            <div class="field"><label>Fecha</label><input id="r_date" type="date" value="${dateValue}" /></div>
            <div class="field"><label>Observación</label><input id="r_note" value="${isEdit ? U.escapeHtml(record.note || '') : ''}" placeholder="Ej: Ventas del 4 de julio" /></div>
          </div>
          <p class="section-title">Ventas por producto</p>
          <p class="text-muted" style="margin-bottom:8px">Escribe cuántas unidades se vendieron de <strong>contado</strong> y cuántas a <strong>crédito</strong>. Si hay crédito, indica la <strong>CC</strong> y el <strong>nombre</strong> del cliente.</p>
          <div class="table-wrap"><table class="line-items"><thead><tr>
            <th>Producto</th><th class="num">Precio</th><th class="num">Contado</th><th class="num">Crédito</th><th>Cliente (si hay crédito)</th>
          </tr></thead><tbody>${rows}</tbody></table></div>
          <div class="row-flex" style="justify-content:flex-end;gap:16px;margin-top:10px">
            <span>Contado: <strong id="sumCash" class="text-green">$ 0</strong></span>
            <span>Crédito: <strong id="sumCredit" class="text-amber">$ 0</strong></span>
          </div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn primary" data-s>${isEdit ? 'Guardar cambios' : 'Guardar borrador'}</button>`,
      });

      const priceOf = {}; products.forEach((p) => { priceOf[p.id] = p.price; });

      const recalcRow = (tr) => {
        const credit = Number(tr.querySelector('.creditq').value) || 0;
        tr.querySelector('.credit-fields').style.opacity = credit > 0 ? '1' : '0.4';
        tr.querySelector('.cc').disabled = credit === 0;
        tr.querySelector('.cname').disabled = credit === 0;
      };
      const recalcTotals = () => {
        let cash = 0, credit = 0;
        box.querySelectorAll('tr[data-pid]').forEach((tr) => {
          const pid = Number(tr.dataset.pid);
          cash += (Number(tr.querySelector('.cashq').value) || 0) * priceOf[pid];
          credit += (Number(tr.querySelector('.creditq').value) || 0) * priceOf[pid];
        });
        box.querySelector('#sumCash').textContent = U.money(cash);
        box.querySelector('#sumCredit').textContent = U.money(credit);
      };

      box.querySelectorAll('tr[data-pid]').forEach((tr) => {
        recalcRow(tr);
        tr.querySelector('.cashq').oninput = recalcTotals;
        tr.querySelector('.creditq').oninput = () => { recalcRow(tr); recalcTotals(); };
        tr.querySelector('.cc').onblur = () => {
          const cc = tr.querySelector('.cc').value.trim();
          const nameEl = tr.querySelector('.cname');
          if (cc && customersByCc[cc] && !nameEl.value.trim()) nameEl.value = customersByCc[cc];
        };
      });
      recalcTotals();

      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        const items = [];
        for (const tr of box.querySelectorAll('tr[data-pid]')) {
          const cashQty = Number(tr.querySelector('.cashq').value) || 0;
          const creditQty = Number(tr.querySelector('.creditq').value) || 0;
          if (cashQty === 0 && creditQty === 0) continue;
          const item = { productId: Number(tr.dataset.pid), cashQty, creditQty };
          if (creditQty > 0) {
            item.customerCc = tr.querySelector('.cc').value.trim();
            item.customerName = tr.querySelector('.cname').value.trim();
          }
          items.push(item);
        }
        if (items.length === 0) return U.toast('Ingresa al menos una cantidad vendida.', 'error');
        const payload = { date: box.querySelector('#r_date').value, note: box.querySelector('#r_note').value, items };
        try {
          if (isEdit) await API.put('/sales-records/' + record.id, payload);
          else await API.post('/sales-records', payload);
          U.closeModal(); U.toast('Registro guardado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function viewDetail(id) {
      const r = await API.get('/sales-records/' + id);
      const isDraft = r.status !== 'APPROVED';
      const box = U.modal({
        title: `Registro #${r.id} · ${U.date(r.date)}`,
        wide: true,
        bodyHtml: `
          <p class="text-muted">${U.escapeHtml(r.note || '')} ${isDraft ? '<span class="badge amber">Borrador</span>' : '<span class="badge green">Aprobado</span>'}</p>
          ${U.table(
            [
              { key: 'prod', label: 'Producto', render: (i) => U.escapeHtml(i.product.name) },
              { key: 'unitPrice', label: 'Precio', num: true, render: (i) => U.money(i.unitPrice) },
              { key: 'cashQty', label: 'Contado', num: true },
              { key: 'creditQty', label: 'Crédito', num: true },
              { key: 'cliente', label: 'Cliente crédito', render: (i) => i.creditQty > 0 ? `${U.escapeHtml(i.customerName || '')} <span class="text-muted">(CC ${U.escapeHtml(i.customerCc || '')})</span>` : '—' },
            ],
            r.items
          )}
          <div class="row-flex" style="justify-content:flex-end;gap:16px;margin-top:10px">
            <span>Contado: <strong class="text-green">${U.money(r.cashTotal)}</strong></span>
            <span>Crédito: <strong class="text-amber">${U.money(r.creditTotal)}</strong></span>
            <span>Total: <strong>${U.money(r.total)}</strong></span>
          </div>
          ${isDraft ? '<div class="info-box" style="margin-top:12px">Al aprobar se descontará el stock y se generarán las ventas y los créditos. Después no se podrá editar.</div>' : ''}`,
        footerHtml: isDraft
          ? `<button class="btn" data-c>Cerrar</button><button class="btn danger" data-del>Eliminar</button><button class="btn" data-edit>Editar</button><button class="btn success" data-approve>Aprobar</button>`
          : `<button class="btn" data-c>Cerrar</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      const edit = box.querySelector('[data-edit]');
      const approve = box.querySelector('[data-approve]');
      const del = box.querySelector('[data-del]');
      if (edit) edit.onclick = () => { U.closeModal(); openForm(r); };
      if (approve) approve.onclick = async () => {
        if (!(await U.confirm('Al aprobar se descontará el stock y se crearán las ventas y créditos. ¿Continuar?', { okText: 'Aprobar' }))) return;
        try { await API.post(`/sales-records/${id}/approve`); U.closeModal(); U.toast('Registro aprobado. Ventas y créditos generados.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
      if (del) del.onclick = async () => {
        if (!(await U.confirm('¿Eliminar este borrador?', { danger: true, okText: 'Eliminar' }))) return;
        try { await API.del('/sales-records/' + id); U.closeModal(); U.toast('Borrador eliminado.', 'success'); load(); }
        catch (e) { U.toast(e.message, 'error'); }
      };
    }

    await load();
  },
};
