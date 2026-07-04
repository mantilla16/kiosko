/* Utilidades compartidas del dashboard (objeto global U) */
const U = (() => {
  const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const money = (n) => pesos.format(Number(n) || 0);
  const num   = (n) => new Intl.NumberFormat('es-CO').format(Number(n) || 0);

  const date = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Icono Lucide como string HTML (para usar dentro de template literals)
  const icon = (name, cls = '') =>
    `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;

  // Inicializar iconos Lucide en un contenedor (o en todo el documento)
  const initIcons = (ctx) => {
    if (window.lucide) lucide.createIcons({ context: ctx || document.body });
  };

  // Crear elemento desde HTML
  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  // Notificaciones
  const toast = (msg, type = 'info') => {
    const box = document.getElementById('toasts');
    const t = el(`<div class="toast ${type}">${escapeHtml(msg)}</div>`);
    box.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 300);
    }, 3200);
  };

  // Modal genérico
  const modal = ({ title, bodyHtml, footerHtml = '', wide = false }) => {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modal');
    box.className = 'modal' + (wide ? ' wide' : '');
    box.innerHTML = `
      <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="close" data-close>${icon('x')}</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ''}`;
    overlay.hidden = false;
    box.querySelector('[data-close]').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    initIcons(box);
    return box;
  };
  const closeModal = () => {
    document.getElementById('modalOverlay').hidden = true;
    document.getElementById('modal').innerHTML = '';
  };

  // Confirmación (promesa)
  const confirm = (msg, { okText = 'Confirmar', danger = false } = {}) =>
    new Promise((resolve) => {
      const box = modal({
        title: 'Confirmar',
        bodyHtml: `<p>${escapeHtml(msg)}</p>`,
        footerHtml: `<button class="btn" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${escapeHtml(okText)}</button>`,
      });
      box.querySelector('[data-yes]').onclick = () => { closeModal(); resolve(true); };
      box.querySelector('[data-no]').onclick  = () => { closeModal(); resolve(false); };
    });

  // Tabla genérica
  const table = (columns, rows, { empty = 'Sin registros.' } = {}) => {
    if (!rows.length) return `<div class="empty">${empty}</div>`;
    const head = columns.map((c) => `<th class="${c.num ? 'num' : ''}">${c.label}</th>`).join('');
    const body = rows
      .map((r) => '<tr>' + columns.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : escapeHtml(r[c.key])}</td>`).join('') + '</tr>')
      .join('');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const statusBadge = (status) => {
    const map = { PAID: ['green', 'Pagado'], PARTIAL: ['amber', 'Parcial'], PENDING: ['red', 'Pendiente'] };
    const [cls, label] = map[status] || ['gray', status || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  // Descargar datos como CSV (se abre en Excel). rows2d: arreglo de filas; la primera fila son los encabezados.
  // Usa ';' como separador (lo que espera Excel en configuración regional de Colombia) y BOM UTF-8.
  const downloadCSV = (filename, rows2d) => {
    const cell = (v) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '﻿' + rows2d.map((row) => row.map(cell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  // Abrir una ventana con una tabla lista para imprimir o guardar como PDF (Ctrl+P → Guardar como PDF).
  const printTable = (title, headers, rows2d) => {
    const thead = '<tr>' + headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
    const tbody = rows2d.map((r) => '<tr>' + r.map((c) => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>').join('');
    const w = window.open('', '_blank');
    if (!w) { toast('Permite las ventanas emergentes para imprimir.', 'error'); return; }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#1a1d24;padding:24px}
        h1{font-size:18px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f2f3f5}
        tr:nth-child(even) td{background:#fafafa}
        @media print{ .noprint{display:none} }
      </style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">Kiosco Caballeriza · Generado el ${new Date().toLocaleString('es-CO')}</div>
      <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`);
    w.document.close();
  };

  return { money, num, date, today, escapeHtml, icon, initIcons, el, toast, modal, closeModal, confirm, table, statusBadge, downloadCSV, printTable };
})();
