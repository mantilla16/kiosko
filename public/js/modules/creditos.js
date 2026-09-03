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
            <td>${g.customer ? `<button class="btn sm" data-hist="${g.customer.id}">Ver factura</button>` : ''}</td>
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

    // Badge de estado con estilos en línea (sirve también dentro de la ventana de impresión).
    function estadoBadge(st) {
      const m = { PAID: ['#e6f7ec', '#1a7f37', 'Pagado'], PARTIAL: ['#fdf3e2', '#b26a00', 'Parcial'], PENDING: ['#fdecec', '#c0392b', 'Pendiente'] };
      const [bg, fg, label] = m[st] || ['#eee', '#555', st || '—'];
      return `<span class="fx-badge" style="background:${bg};color:${fg};border:1px solid ${fg}55">${label}</span>`;
    }

    // Construye la factura / estado de cuenta de un cliente (mismo HTML para el modal y la impresión).
    function invoiceHtml(h, kioskName) {
      const c = h.customer || {};
      const credits = h.sales || [];
      const style = `<style>
        .factura{max-width:720px;margin:0 auto;color:#1a1d24;font-size:13px}
        .factura .fx-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
        .factura .fx-biz{font-size:20px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
        .factura .fx-muted{color:#666;font-size:12px}
        .factura .fx-right{text-align:right}
        .factura .fx-client{display:flex;gap:24px;flex-wrap:wrap;background:#f6f7f9;padding:10px 12px;border-radius:8px;margin-bottom:14px}
        .factura .fx-credit{border:1px solid #e3e6ea;border-radius:8px;padding:10px 12px;margin-bottom:12px}
        .factura .fx-credit-head{display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:6px}
        .factura table.fx-items{width:100%;border-collapse:collapse;font-size:12px}
        .factura table.fx-items th{background:#f2f3f5;text-align:left;padding:5px 8px;border-bottom:1px solid #ddd}
        .factura table.fx-items td{padding:5px 8px;border-bottom:1px solid #eee}
        .factura table.fx-items .n{text-align:right}
        .factura .fx-ctot{display:flex;justify-content:flex-end;gap:18px;margin-top:6px;font-size:12px}
        .factura .fx-pays{color:#666;font-size:11px;margin-top:4px}
        .factura .fx-grand{margin-top:14px;border-top:2px solid #111;padding-top:10px;text-align:right}
        .factura .fx-debt{font-size:18px;font-weight:800;color:#c0392b;margin-top:2px}
        .factura .fx-badge{font-size:11px;padding:1px 8px;border-radius:999px}
      </style>`;

      const creditsHtml = credits.map((s) => {
        const items = s.items.map((i) => `<tr>
          <td>${U.escapeHtml(i.product.name)}</td>
          <td class="n">${i.quantity}</td>
          <td class="n">${U.money(i.unitPrice)}</td>
          <td class="n">${U.money(i.total != null ? i.total : i.quantity * i.unitPrice)}</td>
        </tr>`).join('');
        const pays = (s.payments && s.payments.length)
          ? `<div class="fx-pays">Abonos: ${s.payments.map((p) => `${U.date(p.date)} ${U.money(p.amount)}`).join(' · ')}</div>` : '';
        return `<div class="fx-credit">
          <div class="fx-credit-head">
            <span>Crédito ${s.creditNumber ? '#' + s.creditNumber : ''} · ${U.date(s.date)}</span>
            <span>${estadoBadge(s.status)}${s.dueDate ? ` · Vence ${U.date(s.dueDate)}` : ''}</span>
          </div>
          <table class="fx-items">
            <thead><tr><th>Producto</th><th class="n">Cant.</th><th class="n">V. Unit.</th><th class="n">Subtotal</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
          <div class="fx-ctot"><span>Total ${U.money(s.total)}</span><span>Abonado ${U.money(s.paid)}</span><span><strong>Saldo ${U.money(s.balance)}</strong></span></div>
          ${pays}
        </div>`;
      }).join('');

      const totalCred = credits.reduce((a, s) => a + s.total, 0);
      const totalPaid = credits.reduce((a, s) => a + s.paid, 0);

      return `${style}<div class="factura">
        <div class="fx-head">
          <div><div class="fx-biz">${U.escapeHtml(kioskName || 'Kiosco')}</div><div class="fx-muted">Estado de cuenta · Créditos</div></div>
          <div class="fx-right"><div><strong>Fecha:</strong> ${U.date(new Date().toISOString())}</div>${h.lastPaymentDate ? `<div class="fx-muted">Último pago: ${U.date(h.lastPaymentDate)}</div>` : ''}</div>
        </div>
        <div class="fx-client">
          <div><strong>Cliente:</strong> ${U.escapeHtml(c.name || '')}</div>
          <div><strong>CC:</strong> ${U.escapeHtml(c.cc || '—')}</div>
          <div><strong>Teléfono:</strong> ${U.escapeHtml(c.phone || '—')}</div>
        </div>
        ${creditsHtml || '<p class="fx-muted">Sin compras a crédito.</p>'}
        <div class="fx-grand">
          <div class="fx-muted">Total en créditos: ${U.money(totalCred)} · Abonado: ${U.money(totalPaid)}</div>
          <div class="fx-debt">SALDO TOTAL: ${U.money(h.totalDebt)}</div>
        </div>
      </div>`;
    }

    async function history(customerId) {
      const h = await API.get(`/credits/customers/${customerId}/history`);
      const sel = document.getElementById('kioskSelect');
      const kioskName = (sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : 'Kiosco').trim();
      const html = invoiceHtml(h, kioskName);
      const box = U.modal({
        title: `Factura · ${U.escapeHtml(h.customer.name)}`,
        wide: true,
        bodyHtml: html,
        footerHtml: `<button class="btn" data-c>Cerrar</button><button class="btn primary" data-print>${U.icon('printer')} Imprimir</button>`,
      });
      box.querySelector('[data-c]').onclick = U.closeModal;
      box.querySelector('[data-print]').onclick = () => U.printHtml(`Factura - ${h.customer.name}`, html);
    }

    await load();
  },
};
