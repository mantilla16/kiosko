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
      view.innerHTML = `
        <div class="cards">
          <div class="kpi accent-red"><div class="label">Total por cobrar</div><div class="value">${U.money(totalPending)}</div><div class="sub">${credits.length} crédito(s)</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Créditos</h2>
            <label class="row-flex" style="font-weight:500"><input type="checkbox" id="pend" ${state.onlyPending ? 'checked' : ''} style="width:auto"> Solo pendientes</label></div>
          <div class="panel-body flush">
            ${U.table(
              [
                { key: 'num', label: 'N° crédito', render: (r) => r.creditNumber ? `#${r.creditNumber}` : '—' },
                { key: 'date', label: 'Fecha', render: (r) => U.date(r.date) },
                { key: 'cliente', label: 'Cliente', render: (r) => r.customer ? `${U.escapeHtml(r.customer.name)}${r.customer.cc ? ` <span class="text-muted">(CC ${U.escapeHtml(r.customer.cc)})</span>` : ''}` : '—' },
                { key: 'total', label: 'Total', num: true, render: (r) => U.money(r.total) },
                { key: 'paid', label: 'Abonado', num: true, render: (r) => U.money(r.paid) },
                { key: 'balance', label: 'Saldo', num: true, render: (r) => `<strong class="${r.balance > 0 ? 'text-red' : 'text-green'}">${U.money(r.balance)}</strong>` },
                { key: 'due', label: 'Límite', render: (r) => U.date(r.dueDate) || '—' },
                { key: 'status', label: 'Estado', render: (r) => U.statusBadge(r.status) },
                { key: 'acc', label: '', render: (r) => `${r.balance > 0 ? `<button class="btn sm primary" data-pay="${r.id}">Abonar</button>` : ''} ${r.customer ? `<button class="btn sm" data-hist="${r.customer.id}">Historial</button>` : ''}` },
              ],
              credits,
              { empty: 'No hay créditos para mostrar.' }
            )}
          </div>
        </div>`;
      document.getElementById('pend').onchange = (e) => { state.onlyPending = e.target.checked; load(); };
      view.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => pay(credits.find((c) => c.id == b.dataset.pay))));
      view.querySelectorAll('[data-hist]').forEach((b) => (b.onclick = () => history(b.dataset.hist)));
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
