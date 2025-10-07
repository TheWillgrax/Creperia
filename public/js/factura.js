// /js/factura.js
(function () {
  const GT_FORMAT = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
  const fmtQ = n => GT_FORMAT.format(n ?? 0);
  const fmtDateGT = (iso) => {
    try {
      return new Date(iso).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
    } catch { return '—'; }
  };

  const $ = (sel) => document.querySelector(sel);

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.invoice-container');
    let order = null;

    try {
      order = JSON.parse(localStorage.getItem('lastOrder') || 'null');
    } catch { order = null; }

    if (!order) {
      container.innerHTML = `
        <div class="invoice-header">
          <div class="brand-badge">CO</div>
          <div class="header-text">
            <h1>Factura</h1>
            <p>No hay factura disponible.</p>
          </div>
        </div>`;
      return;
    }

    // Datos “seller” (puedes reemplazar por los reales o traerlos del backend)
    const seller = {
      name: 'Crepería OyE',
      nit: '1234567-OYE',
      phone: '(502) 5555-5555'
    };

    // Campos con fallback
    const customer = order.customer ?? {};
    const items = Array.isArray(order.items) ? order.items : [];
    const orderId = order.orderId ?? order.id ?? '—';
    const createdAt = fmtDateGT(order.createdAt ?? Date.now());
    const method = order.paymentMethod ?? (order.cardLast4 ? `Tarjeta •••• ${order.cardLast4}` : '—');
    const taxRate = typeof order.taxRate === 'number' ? order.taxRate : 0.12; // GT IVA 12% por defecto

    // Meta
    $('#meta-order').textContent = String(orderId);
    $('#meta-date').textContent = createdAt;
    $('#meta-method').textContent = method;

    // Cliente
    $('#c-name').textContent = customer.name ?? '—';
    $('#c-email').textContent = customer.email ?? '—';
    $('#c-address').textContent = customer.address ?? '—';

    // Render items + cálculo de totales
    const tbody = $('#invoice-items');
    tbody.innerHTML = '';

    let subtotal = 0;
    for (const it of items) {
      const name = it.name ?? it.productName ?? 'Producto';
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.price ?? it.unitPrice ?? 0);
      const line = price * qty;
      subtotal += line;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td>${qty}</td>
        <td>${fmtQ(price)}</td>
        <td>${fmtQ(line)}</td>
      `;
      tbody.appendChild(tr);
    }

    const tax = Math.max(0, round2(subtotal * taxRate));
    const total = round2(subtotal + tax);

    $('#t-subtotal').textContent = fmtQ(subtotal);
    $('#t-tax').textContent = fmtQ(tax);
    $('#t-total').textContent = fmtQ(total);

    // Botón imprimir (mejor que window.print en PDF)
    $('#print-invoice')?.addEventListener('click', () => window.print());

    // Descargar PDF
    $('#download-invoice')?.addEventListener('click', () => {
      if (!window.jspdf?.jsPDF) {
        window.print(); // fallback
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      const M = 48;           // margen
      let y = M;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Factura', M, y);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      y += 18;
      doc.text(`${seller.name} · NIT: ${seller.nit} · Tel: ${seller.phone}`, M, y);
      y += 22;

      // Meta / Cliente
      const left = [
        `Orden: ${orderId}`,
        `Fecha: ${createdAt}`,
        `Método: ${method || '—'}`,
        `Estado: ${order.status || 'Pagada'}`
      ];
      const right = [
        `Cliente: ${customer.name || '—'}`,
        `Email: ${customer.email || '—'}`,
        `Dirección: ${customer.address || '—'}`
      ];
      doc.setFont('helvetica', 'bold'); doc.text('Detalles', M, y);
      doc.setFont('helvetica', 'normal'); y += 14;
      left.forEach((l, i) => doc.text(l, M, y + i * 14));
      right.forEach((r, i) => doc.text(r, 320, y + i * 14));
      y += Math.max(left.length, right.length) * 14 + 12;

      // Tabla con autoTable
      const tableBody = items.map(it => ([
        String(it.name ?? it.productName ?? 'Producto'),
        String(it.quantity ?? 0),
        fmtQ(Number(it.price ?? it.unitPrice ?? 0)),
        fmtQ(Number(it.price ?? it.unitPrice ?? 0) * Number(it.quantity ?? 0))
      ]));

      doc.autoTable({
        startY: y,
        head: [['Producto', 'Cantidad', 'Precio', 'Subtotal']],
        body: tableBody,
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [241, 245, 249], textColor: 20 },
        theme: 'striped',
        margin: { left: M, right: M }
      });

      // Totales
      const endY = doc.lastAutoTable?.finalY ?? y;
      const totalsX = 320; // columna derecha
      let ty = endY + 14;

      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, ty); doc.text(fmtQ(subtotal), totalsX + 150, ty, { align: 'right' });
      ty += 14;
      doc.text(`IVA (${(taxRate * 100).toFixed(0)}%):`, totalsX, ty); doc.text(fmtQ(tax), totalsX + 150, ty, { align: 'right' });
      ty += 16;
      doc.setFont('helvetica', 'bold');
      doc.text('Total:', totalsX, ty); doc.text(fmtQ(total), totalsX + 150, ty, { align: 'right' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Gracias por su compra. No requiere firma.', M, 812);

      doc.save(`factura_${orderId}.pdf`);
    });
  });

  // Utils
  function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, s => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]
    ));
  }
})();
