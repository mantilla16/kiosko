/* Módulo: Registro de ventas (control contable) — reemplaza Ventas en vivo e Inventario Físico.
   Por cada producto se anota la cantidad vendida de contado y, opcionalmente, una o varias
   porciones a crédito (cada una para un cliente distinto: CC único + nombre).
   Se puede guardar como borrador editable o "Guardar y registrar" (aprueba de una: genera
   las ventas, descuenta stock y crea los créditos — uno por cliente, número secuencial). */
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
                { key: 'items', label: 'Líneas', num: true, render: (r) => r.items.length },
                { key: 'cashTotal', label: 'Contado', num: true, render: (r) => `<span class="text-green">${U.money(r.cashTotal)}</span>` },
                { key: 'creditTotal', label: 'Crédito', num: true, render: (r) => `<span class="text-amber">${U.money(r.creditTotal)}</span>` },
                { key: 'total', label: 'Total', num: true, render: (r) => `<strong>${U.money(r.total)}</strong>` },
                { key: 'status', label: 'Estado', render: (r) => r.status === 'APPROVED' ? '<span class="badge green">Registrado</span>' : '<span class="badge amber">Borrador</span>' },
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

    // Construye una línea de crédito (cantidad + cliente) para un producto.
    function creditLineHtml(qty = '', cc = '', name = '') {
      return `<div class="credit-line row-flex" style="gap:4px;margin-top:4px;flex-wrap:wrap;align-items:center">
        <input class="input-sm cq" type="number" min="1" placeholder="Cant." value="${qty}" style="width:64px" />
        <input class="input-sm cc" placeholder="CC" value="${U.escapeHtml(cc)}" style="width:96px" />
        <input class="input-sm cname" placeholder="Nombre" value="${U.escapeHtml(name)}" style="width:120px" />
        <button type="button" class="btn-icon rm" title="Quitar">${U.icon('x', 'icon-xs')}</button>
      </div>`;
    }

    // Formulario de registro (nuevo o edición de borrador).
    function openForm(record = null) {
      const isEdit = !!record;
      // Precargar por producto: cantidad de contado y líneas de crédito.
      const cashByProduct = {};
      const creditsByProduct = {};
      if (record) {
        for (const i of record.items) {
          if (i.kind === 'CASH') cashByProduct[i.productId] = (cashByProduct[i.productId] || 0) + i.qty;
          else (creditsByProduct[i.productId] = creditsByProduct[i.productId] || []).push(i);
        }
      }
      const dateValue = isEdit ? new Date(record.date).toISOString().slice(0, 10) : U.today();

      const rows = products.map((p) => {
        const cash = cashByProduct[p.id] || 0;
        const creds = creditsByProduct[p.id] || [];
        return `<tr data-pid="${p.id}">
          <td>${U.escapeHtml(p.name)} <span class="text-muted">(${p.stock} disp.)</span></td>
          <td class="num">${U.money(p.price)}</td>
          <td><input class="input-sm cashq" type="number" min="0" value="${cash}" style="width:70px" /></td>
          <td>
            <div class="credits-wrap">${creds.map((c) => creditLineHtml(c.qty, c.customerCc || '', c.customerName || '')).join('')}</div>
            <button type="button" class="btn sm ghost add-credit">+ cliente a crédito</button>
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
          <p class="text-muted" style="margin-bottom:8px">Escribe las unidades vendidas de <strong>contado</strong>. Para crédito, agrega uno o varios clientes con "+ cliente a crédito" (cantidad + CC + nombre).</p>
          <div class="table-wrap"><table class="line-items"><thead><tr>
            <th>Producto</th><th class="num">Precio</th><th class="num">Contado</th><th>Crédito (por cliente)</th>
          </tr></thead><tbody>${rows}</tbody></table></div>
          <div class="row-flex" style="justify-content:flex-end;gap:16px;margin-top:10px">
            <span>Contado: <strong id="sumCash" class="text-green">$ 0</strong></span>
            <span>Crédito: <strong id="sumCredit" class="text-amber">$ 0</strong></span>
          </div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button>
          <button class="btn" data-draft>Guardar borrador</button>
          <button class="btn primary" data-register>Guardar y registrar</button>`,
      });

      const priceOf = {}; products.forEach((p) => { priceOf[p.id] = p.price; });

      const recalcTotals = () => {
        let cash = 0, credit = 0;
        box.querySelectorAll('tr[data-pid]').forEach((tr) => {
          const price = priceOf[Number(tr.dataset.pid)];
          cash += (Number(tr.querySelector('.cashq').value) || 0) * price;
          tr.querySelectorAll('.credit-line .cq').forEach((q) => { credit += (Number(q.value) || 0) * price; });
        });
        box.querySelector('#sumCash').textContent = U.money(cash);
        box.querySelector('#sumCredit').textContent = U.money(credit);
      };

      const wireCreditLine = (line) => {
        line.querySelector('.cq').oninput = recalcTotals;
        line.querySelector('.rm').onclick = () => { line.remove(); recalcTotals(); };
        line.querySelector('.cc').onblur = () => {
          const cc = line.querySelector('.cc').value.trim();
          const nameEl = line.querySelector('.cname');
          if (cc && customersByCc[cc] && !nameEl.value.trim()) nameEl.value = customersByCc[cc];
        };
      };

      box.querySelectorAll('tr[data-pid]').forEach((tr) => {
        tr.querySelector('.cashq').oninput = recalcTotals;
        tr.querySelectorAll('.credit-line').forEach(wireCreditLine);
        tr.querySelector('.add-credit').onclick = () => {
          const wrap = tr.querySelector('.credits-wrap');
          wrap.insertAdjacentHTML('beforeend', creditLineHtml());
          const line = wrap.lastElementChild;
          U.initIcons(line);
          wireCreditLine(line);
        };
      });
      recalcTotals();

      function gatherItems() {
        const items = [];
        for (const tr of box.querySelectorAll('tr[data-pid]')) {
          const cashQty = Number(tr.querySelector('.cashq').value) || 0;
          const credits = [];
          tr.querySelectorAll('.credit-line').forEach((line) => {
            const qty = Number(line.querySelector('.cq').value) || 0;
            if (qty <= 0) return;
            credits.push({ qty, customerCc: line.querySelector('.cc').value.trim(), customerName: line.querySelector('.cname').value.trim() });
          });
          if (cashQty === 0 && credits.length === 0) continue;
          items.push({ productId: Number(tr.dataset.pid), cashQty, credits });
        }
        return items;
      }

      async function save(register) {
        const items = gatherItems();
        if (items.length === 0) return U.toast('Ingresa al menos una cantidad vendida.', 'error');
        const payload = { date: box.querySelector('#r_date').value, note: box.querySelector('#r_note').value, items };
        try {
          const rec = isEdit
            ? await API.put('/sales-records/' + record.id, payload)
            : await API.post('/sales-records', payload);
          if (register) {
            await API.post(`/sales-records/${rec.id}/approve`);
            U.toast('Venta registrada. Stock y créditos actualizados.', 'success');
          } else {
            U.toast('Borrador guardado.', 'success');
          }
          U.closeModal(); load();
        } catch (e) {
          U.toast(e.message, 'error');
          if (register) load(); // la venta quedó como borrador aunque falle la aprobación
        }
      }

      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-draft]').onclick = () => save(false);
      box.querySelector('[data-register]').onclick = () => save(true);
    }

    async function viewDetail(id) {
      const r = await API.get('/sales-records/' + id);
      const isDraft = r.status !== 'APPROVED';
      const box = U.modal({
        title: `Registro #${r.id} · ${U.date(r.date)}`,
        wide: true,
        bodyHtml: `
          <p class="text-muted">${U.escapeHtml(r.note || '')} ${isDraft ? '<span class="badge amber">Borrador</span>' : '<span class="badge green">Registrado</span>'}</p>
          ${U.table(
            [
              { key: 'prod', label: 'Producto', render: (i) => U.escapeHtml(i.product.name) },
              { key: 'kind', label: 'Tipo', render: (i) => i.kind === 'CASH' ? '<span class="badge green">Contado</span>' : '<span class="badge amber">Crédito</span>' },
              { key: 'qty', label: 'Cantidad', num: true },
              { key: 'unitPrice', label: 'Precio', num: true, render: (i) => U.money(i.unitPrice) },
              { key: 'subtotal', label: 'Subtotal', num: true, render: (i) => U.money(i.qty * i.unitPrice) },
              { key: 'cliente', label: 'Cliente', render: (i) => i.kind === 'CREDIT' ? `${U.escapeHtml(i.customerName || '')} <span class="text-muted">(CC ${U.escapeHtml(i.customerCc || '')})</span>` : '—' },
            ],
            r.items
          )}
          <div class="row-flex" style="justify-content:flex-end;gap:16px;margin-top:10px">
            <span>Contado: <strong class="text-green">${U.money(r.cashTotal)}</strong></span>
            <span>Crédito: <strong class="text-amber">${U.money(r.creditTotal)}</strong></span>
            <span>Total: <strong>${U.money(r.total)}</strong></span>
          </div>
          ${isDraft ? '<div class="info-box" style="margin-top:12px">Este registro es un borrador. Al registrarlo se descontará el stock y se crearán las ventas y los créditos.</div>' : ''}`,
        footerHtml: isDraft
          ? `<button class="btn" data-c>Cerrar</button><button class="btn danger" data-del>Eliminar</button><button class="btn" data-edit>Editar</button><button class="btn success" data-approve>Registrar ahora</button>`
          : `<button class="btn" data-c>Cerrar</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      const edit = box.querySelector('[data-edit]');
      const approve = box.querySelector('[data-approve]');
      const del = box.querySelector('[data-del]');
      if (edit) edit.onclick = () => { U.closeModal(); openForm(r); };
      if (approve) approve.onclick = async () => {
        if (!(await U.confirm('Al registrar se descontará el stock y se crearán las ventas y créditos. ¿Continuar?', { okText: 'Registrar' }))) return;
        try { await API.post(`/sales-records/${id}/approve`); U.closeModal(); U.toast('Venta registrada.', 'success'); load(); }
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
