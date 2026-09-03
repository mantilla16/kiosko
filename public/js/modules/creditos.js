/* Módulo: Créditos / Cuentas por cobrar (cartera) */
window.Routes = window.Routes || {};
window.Routes.creditos = {
  title: 'Créditos',
  async render(view) {
    const state = { onlyPending: true };

    async function load() {
      view.innerHTML = '<div class="loader">Cargando cartera…</div>';
      const credits = await API.get('/credits', { pending: state.onlyPending });
      paint(credits);
    }

    function paint(credits) {
      const totalPending = credits.reduce((a, c) => a + c.balance, 0);

      // Agrupar los créditos por cliente para ver cuánto debe cada persona.
      const groups = new Map();
      for (const c of credits) {
        const key = c.customer ? String(c.customer.id) : 'sin';
        if (!groups.has(key)) groups.set(key, { customer: c.customer, credits: [], total: 0, paid: 0, balance: 0 });
        const g = groups.get(key);
        g.credits.push(c);
        g.total += c.total; g.paid += c.paid; g.balance += c.balance;
      }
      const grouped = [...groups.values()].sort((a, b) => b.balance - a.balance);

      // Fila de un crédito individual (dentro del detalle de la persona).
      const creditRow = (c) => `
        <tr>
          <td>${c.creditNumber ? `#${c.creditNumber}` : '—'}</td>
          <td>${U.date(c.date)}</td>
          <td>${U.escapeHtml(c.items.map((i) => `${i.product.name} x${i.quantity}`).join(', '))}</td>
          <td class="num">${U.money(c.total)}</td>
          <td class="num">${U.money(c.paid)}</td>
          <td class="num"><strong class="${c.balance > 0 ? 'text-red' : 'text-green'}">${U.money(c.balance)}</strong></td>
          <td>${U.date(c.dueDate) || '—'}</td>
          <td>${U.statusBadge(c.status)}</td>
          <td>${c.balance > 0 ? `<button class="btn sm primary" data-pay="${c.id}">Abonar</button>` : ''}</td>
        </tr>`;

      // Fila resumen por cliente + fila oculta con el detalle de sus créditos.
      const groupHtml = grouped.map((g) => {
        const cid = g.customer ? String(g.customer.id) : 'sin';
        const name = g.customer ? U.escapeHtml(g.customer.name) : 'Sin cliente';
        const cc = g.customer && g.customer.cc ? ` <span class="text-muted">(CC ${U.escapeHtml(g.customer.cc)})</span>` : '';
        return `
          <tr class="group-row" data-toggle="${cid}" style="cursor:pointer">
            <td><span data-caret="${cid}">▸</span> <strong>${name}</strong>${cc}</td>
            <td class="num">${g.credits.length}</td>
            <td class="num">${U.money(g.total)}</td>
            <td class="num">${U.money(g.paid)}</td>
            <td class="num"><strong class="${g.balance > 0 ? 'text-red' : 'text-green'}">${U.money(g.balance)}</strong></td>
            <td>${g.customer ? `<button class="btn sm" data-hist="${g.customer.id}">Historial</button>` : ''}</td>
          </tr>
          <tr class="detail-row" data-detail="${cid}" hidden>
            <td colspan="6" style="padding:0;background:#f8fafc">
              <table class="line-items" style="margin:0;width:100%">
                <thead><tr>
                  <th>N° crédito</th><th>Fecha</th><th>Productos</th><th class="num">Total</th>
                  <th class="num">Abonado</th><th class="num">Saldo</th><th>Límite</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>${g.credits.map(creditRow).join('')}</tbody>
              </table>
            </td>
          </tr>`;
      }).join('');

      view.innerHTML = `
        <div class="cards">
          <div class="kpi accent-red"><div class="label">Total por cobrar</div><div class="value">${U.money(totalPending)}</div><div class="sub">${grouped.length} cliente(s) · ${credits.length} crédito(s)</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Deuda por cliente</h2>
            <label class="row-flex" style="font-weight:500"><input type="checkbox" id="pend" ${state.onlyPending ? 'checked' : ''} style="width:auto"> Solo pendientes</label></div>
          <div class="panel-body flush">
            ${grouped.length ? `<div class="table-wrap"><table class="line-items"><thead><tr>
              <th>Cliente</th><th class="num">N° créditos</th><th class="num">Total</th><th class="num">Abonado</th><th class="num">Saldo</th><th></th>
            </tr></thead><tbody>${groupHtml}</tbody></table></div>` : '<p class="text-muted" style="padding:16px">No hay créditos para mostrar.</p>'}
          </div>
        </div>`;

      document.getElementById('pend').onchange = (e) => { state.onlyPending = e.target.checked; load(); };

      // Expandir / contraer el detalle de cada cliente.
      view.querySelectorAll('.group-row[data-toggle]').forEach((row) => (row.onclick = (e) => {
        if (e.target.closest('[data-hist]')) return; // el botón Historial no debe togglear
        const cid = row.dataset.toggle;
        const detail = view.querySelector(`.detail-row[data-detail="${cid}"]`);
        const caret = view.querySelector(`[data-caret="${cid}"]`);
        if (detail) { detail.hidden = !detail.hidden; if (caret) caret.textContent = detail.hidden ? '▸' : '▾'; }
      }));

      view.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); pay(credits.find((c) => c.id == b.dataset.pay)); }));
      view.querySelectorAll('[data-hist]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); history(b.dataset.hist); }));
    }

    function pay(credit) {
      const box = U.modal({
        title: `Registrar abono · ${credit.customer ? credit.customer.name : ''}`,
        bodyHtml: `
          <p class="text-muted">Saldo pendiente: <strong>${U.money(credit.balance)}</strong></p>
          <div class="field"><label>Fecha</label><input id="a_date" type="date" value="${U.today()}" /></div>
          <div class="field"><label>Valor del abono</label><input id="a_amount" type="number" min="1" max="${credit.balance}" value="${credit.balance}" /></div>`,
        footerHtml: `<button class="btn" data-c>Cancelar</button><button class="btn success" data-s>Registrar abono</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-s]').onclick = async () => {
        try {
          await API.post(`/credits/${credit.id}/payments`, { amount: box.querySelector('#a_amount').value, date: box.querySelector('#a_date').value });
          U.closeModal(); U.toast('Abono registrado.', 'success'); load();
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }

    async function history(customerId) {
      const h = await API.get(`/credits/customers/${customerId}/history`);
      const box = U.modal({
        title: `Historial · ${U.escapeHtml(h.customer.name)}`,
        wide: true,
        bodyHtml: `
          <div class="cards">
            <div class="kpi accent-red"><div class="label">Saldo pendiente</div><div class="value">${U.money(h.totalDebt)}</div></div>
            <div class="kpi"><div class="label">Último pago</div><div class="value" style="font-size:18px">${h.lastPaymentDate ? U.date(h.lastPaymentDate) : '—'}</div></div>
          </div>
          <p class="section-title">Compras a crédito</p>
          ${U.table(
            [
              { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
              { key: 'prods', label: 'Productos', render: (r) => U.escapeHtml(r.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')) },
              { key: 'total', label: 'Total', num: true, render: (r) => U.money(r.total) },
              { key: 'paid', label: 'Abonado', num: true, render: (r) => U.money(r.paid) },
              { key: 'balance', label: 'Saldo', num: true, render: (r) => U.money(r.balance) },
              { key: 'status', label: 'Estado', render: (r) => U.statusBadge(r.status) },
            ],
            h.sales,
            { empty: 'Sin compras a crédito.' }
          )}`,
        footerHtml: `<button class="btn" data-c>Cerrar</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
    }

    await load();
  },
};
