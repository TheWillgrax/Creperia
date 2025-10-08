// admin.js

// Constantes
const TOKEN_KEY = 'authToken';
const USER_KEY = 'user';

// Variable global para almacenar la función de submit actual
let currentOnSubmit = null;
let currentEditId = null;
let currentEditType = null;

// Función para obtener token y usuario desde localStorage
function getAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return { token, user: user ? JSON.parse(user) : null };
}

// Validar sesión (solo que exista usuario autenticado)
async function checkAuth() {
  const { token, user } = getAuth();

  if (!token || !user) {
    redirectToLogin();
    return false;
  }

  try {
    const res = await fetch('/api/verify', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.valid) {
      redirectToLogin();
      return false;
    }
  } catch {
    redirectToLogin();
    return false;
  }

  return true;
}

function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login.html';
}

// Mostrar perfil con datos del usuario
function loadProfile(user) {
  document.getElementById('perfil-nombre-view').textContent = user.name || '';
  document.getElementById('perfil-email-view').textContent = user.email || '';
  document.getElementById('perfil-telefono-view').textContent = user.phone || '';
  document.getElementById('perfil-direccion-view').textContent = user.address || '';
  document.getElementById('perfil-rol-view').textContent =
    user.role === 'admin' ? 'Administrador' : 'Cliente';
}

// Navegación y renderizado de vistas
const menu = document.getElementById('admin-menu');
const title = document.getElementById('panel-title');

const viewMap = {
  '#perfil': { el: '#view-perfil', icon: 'fa-user-gear', title: 'Mis Datos' },
  '#usuarios': { el: '#view-usuarios', icon: 'fa-users', title: 'Usuarios', adminOnly: true },
  '#productos': { el: '#view-productos', icon: 'fa-cookie', title: 'Productos', adminOnly: true },
  '#costos': { el: '#view-costos', icon: 'fa-calculator', title: 'Costos estimados', adminOnly: true },
  '#pedidos': { el: '#view-pedidos', icon: 'fa-receipt', title: 'Historial de Pedidos' },
  '#config': { el: '#view-config', icon: 'fa-sliders', title: 'Configuración' },
};

const COST_ELEMENTS = [
  { label: 'Materia prima', unitInput: 'cost-unit-mp', monthInput: 'cost-month-mp' },
  { label: 'Mano de obra', unitInput: 'cost-unit-mo', monthInput: 'cost-month-mo' },
  { label: 'Gastos de fabricación', unitInput: 'cost-unit-gf', monthInput: 'cost-month-gf' },
];

let costCalcInitialized = false;
let costReportMeta = {
  monthLabel: 'MES EN CURSO',
  fileLabel: 'mes-en-curso',
};

let configInitialized = false;
function initConfig() {
  if (configInitialized) return;
  configInitialized = true;
  const btn = document.getElementById('btn-toggle-theme');
  if (!btn) return;
  const updateBtn = () => {
    const theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    btn.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i> Tema claro'
      : '<i class="fas fa-moon"></i> Tema oscuro';
  };
  updateBtn();
  btn.addEventListener('click', () => {
    window.toggleTheme && window.toggleTheme();
    updateBtn();
  });
}

function readNumber(id) {
  const input = document.getElementById(id);
  if (!input) return 0;
  const value = parseFloat(input.value);
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? number : 0;
  return `Q ${safeNumber.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUnits(value) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? number : 0;
  const hasDecimals = !Number.isInteger(safeNumber);
  return safeNumber.toLocaleString('es-GT', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
}

function sanitizeFileName(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function buildCostReportMarkup({ forPrint = false } = {}) {
  const container = document.querySelector('#view-costos .costs-results');
  if (!container) return '';

  const clone = container.cloneNode(true);
  clone.querySelectorAll('[data-export-ignore]').forEach(el => el.remove());

  const generatedAt = new Date();
  const formattedDate = generatedAt.toLocaleDateString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const styles = `
    :root {
      --color-primary: #d97706;
      --color-contrast: #92400e;
      --color-dark: #422006;
      --color-bg: #fdf6ed;
      --color-light: #ffffff;
      --color-text-muted: #8d7b68;
    }

    * {
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    body {
      margin: 0;
      padding: 0;
      background: var(--color-bg);
      color: var(--color-dark);
    }

    .report-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 2rem 3rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
      background: rgba(255,255,255,0.92);
    }

    .report-header {
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .report-header h1 {
      margin: 0;
      font-size: 1.85rem;
      color: var(--color-primary);
    }

    .report-period {
      font-weight: 700;
      letter-spacing: 1.1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .report-generated {
      font-size: 0.95rem;
      color: var(--color-text-muted);
    }

    .costs-results {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .cost-warning {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 1rem 1.1rem;
      border-radius: 14px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      font-size: 0.9rem;
    }

    .cost-warning i {
      font-size: 1.1rem;
    }

    .cost-stats {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .cost-stat {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 14px;
      border: 1px solid rgba(217, 119, 6, 0.12);
      padding: 1rem 1.1rem;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .cost-stat-label {
      font-size: 0.78rem;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--color-text-muted);
    }

    .cost-stat-value {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--color-contrast);
    }

    .cost-result {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      padding: 1.4rem 1.6rem;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }

    .cost-result header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .cost-result h3 {
      margin: 0;
      font-size: 1.15rem;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .cost-result-month {
      margin: 0;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: var(--color-text-muted);
      font-size: 0.85rem;
      text-transform: uppercase;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th,
    .table td {
      padding: 0.8rem 1rem;
      border-bottom: 1px solid rgba(217, 119, 6, 0.15);
      text-align: left;
      font-size: 0.95rem;
    }

    .table thead th {
      border-bottom: 2px solid rgba(217, 119, 6, 0.3);
      background: rgba(217, 119, 6, 0.08);
      font-weight: 700;
      color: var(--color-primary);
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.4px;
    }

    .table tfoot td {
      font-weight: 700;
      background: rgba(217, 119, 6, 0.07);
    }

    .status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-block;
      text-transform: capitalize;
    }

    .status.ok {
      background: linear-gradient(135deg, #e6f7ee, #d4f4dd);
      color: #0c9550;
    }

    .status.pending {
      background: linear-gradient(135deg, #fef7ec, #fdecd2);
      color: #f5a623;
    }

    .status.error {
      background: linear-gradient(135deg, #fde8e8, #fcd3d3);
      color: #e53e3e;
    }

    @media print {
      body {
        background: #ffffff;
      }

      .report-container {
        box-shadow: none;
        padding: 1.5rem;
      }

      .cost-result {
        box-shadow: none;
      }
    }
  `;

  const headContent = `
    <meta charset="UTF-8">
    <title>Costos estimados</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
    <style>${styles}</style>
  `;

  const bodyContent = `
    <div class="report-container">
      <header class="report-header">
        <h1>Valoración de costos estimados</h1>
        <p class="report-period">${costReportMeta.monthLabel}</p>
        <p class="report-generated">Reporte generado el ${formattedDate}</p>
      </header>
      ${clone.outerHTML}
    </div>
  `;

  const printScript = forPrint
    ? '<script>window.addEventListener("load", () => { window.print(); setTimeout(() => window.close(), 300); });</script>'
    : '';

  return `<!DOCTYPE html><html lang="es"><head>${headContent}</head><body>${bodyContent}${printScript}</body></html>`;
}

function downloadCostReportExcel() {
  const html = buildCostReportMarkup();
  if (!html) {
    alert('No se encontró información para exportar.');
    return;
  }

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileLabel = costReportMeta.fileLabel || 'costos-estimados';
  link.download = `costos-estimados-${fileLabel || 'reporte'}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadCostReportPdf() {
  const html = buildCostReportMarkup({ forPrint: true });
  if (!html) {
    alert('No se encontró información para exportar.');
    return;
  }

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    alert('No se pudo abrir la ventana de impresión. Verifica el bloqueador de ventanas emergentes.');
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
}

function updateProductionTable(tbodyId, totalId, units, unitCosts) {
  const tbody = document.getElementById(tbodyId);

  const rows = COST_ELEMENTS.map((element, index) => {
    const unitCost = Number.isFinite(unitCosts[index]) ? unitCosts[index] : 0;
    const costTotal = units * unitCost;
    return {
      label: element.label,
      units,
      unitCost,
      total: costTotal,
    };
  });

  if (tbody) {
    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.label}</td>
        <td>${formatUnits(row.units)}</td>
        <td>${formatCurrency(row.unitCost)}</td>
        <td>${formatCurrency(row.total)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const total = rows.reduce((acc, row) => acc + row.total, 0);
  const totalCell = document.getElementById(totalId);
  if (totalCell) {
    totalCell.textContent = formatCurrency(total);
  }

  return { rows, total };
}

function updateAdjustmentTable(tbodyId, units, estimatedUnitCosts, correctedUnitCosts, totalIds) {
  const safeUnits = Number.isFinite(units) ? units : 0;
  const rows = COST_ELEMENTS.map((element, index) => {
    const estimatedUnit = Number.isFinite(estimatedUnitCosts[index]) ? estimatedUnitCosts[index] : 0;
    const correctedUnit = Number.isFinite(correctedUnitCosts[index]) ? correctedUnitCosts[index] : 0;
    const estimatedTotal = safeUnits * estimatedUnit;
    const correctedTotal = safeUnits * correctedUnit;
    const adjustment = correctedTotal - estimatedTotal;

    return {
      label: element.label,
      units: safeUnits,
      estimatedUnit,
      correctedUnit,
      estimatedTotal,
      correctedTotal,
      adjustment,
    };
  });

  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.label}</td>
        <td>${formatUnits(row.units)}</td>
        <td>${formatCurrency(row.estimatedUnit)}</td>
        <td>${formatCurrency(row.estimatedTotal)}</td>
        <td>${formatCurrency(row.correctedUnit)}</td>
        <td>${formatCurrency(row.correctedTotal)}</td>
        <td>${formatCurrency(row.adjustment)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.estimated += row.estimatedTotal;
      acc.corrected += row.correctedTotal;
      acc.adjustment += row.adjustment;
      return acc;
    },
    { estimated: 0, corrected: 0, adjustment: 0 }
  );

  if (totalIds) {
    const estimatedEl = document.getElementById(totalIds.estimated);
    const correctedEl = document.getElementById(totalIds.corrected);
    const adjustmentEl = document.getElementById(totalIds.adjustment);

    if (estimatedEl) estimatedEl.textContent = formatCurrency(totals.estimated);
    if (correctedEl) correctedEl.textContent = formatCurrency(totals.corrected);
    if (adjustmentEl) adjustmentEl.textContent = formatCurrency(totals.adjustment);
  }

  return {
    adjustments: rows.map(row => row.adjustment),
    totals,
  };
}

function updateAdjustmentSummary(rows) {
  const tbody = document.getElementById('cost-adjust-summary-body');
  const totalRow = document.getElementById('cost-adjust-summary-total-row');
  if (!tbody || !totalRow) return;

  tbody.innerHTML = '';

  const totalsByElement = COST_ELEMENTS.map(() => 0);
  let grandTotal = 0;

  rows.forEach(row => {
    const elementValues = COST_ELEMENTS.map((_, index) => {
      const value = Array.isArray(row.adjustments) ? row.adjustments[index] : 0;
      return Number.isFinite(value) ? value : 0;
    });
    const rowTotal = elementValues.reduce((acc, value) => acc + value, 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.label}</td>
      ${elementValues.map(value => `<td>${formatCurrency(value)}</td>`).join('')}
      <td>${formatCurrency(rowTotal)}</td>
    `;
    tbody.appendChild(tr);

    elementValues.forEach((value, index) => {
      totalsByElement[index] += value;
    });
    grandTotal += rowTotal;
  });

  totalRow.innerHTML = `
    <td>Total</td>
    ${totalsByElement.map(value => `<td>${formatCurrency(value)}</td>`).join('')}
    <td>${formatCurrency(grandTotal)}</td>
  `;
}

function getVariationStatus(amount) {
  if (amount < 0) {
    return { label: 'Favorable', className: 'ok' };
  }
  if (amount > 0) {
    return { label: 'Desfavorable', className: 'error' };
  }
  return { label: 'Sin variación', className: 'pending' };
}

function formatCoefficient(value) {
  if (!Number.isFinite(value)) return '0.0000';
  return value.toLocaleString('es-GT', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function initCostCalculator() {
  if (costCalcInitialized) return;

  const form = document.getElementById('costos-form');
  if (!form) return;

  costCalcInitialized = true;

  const warningEl = document.getElementById('cost-warning');
  const excelButton = document.getElementById('btn-cost-export-excel');
  const pdfButton = document.getElementById('btn-cost-export-pdf');

  if (excelButton) {
    excelButton.addEventListener('click', event => {
      event.preventDefault();
      downloadCostReportExcel();
    });
  }

  if (pdfButton) {
    pdfButton.addEventListener('click', event => {
      event.preventDefault();
      downloadCostReportPdf();
    });
  }

  const update = () => {
    const unitCosts = COST_ELEMENTS.map(item => readNumber(item.unitInput));
    const monthlyCosts = COST_ELEMENTS.map(item => readNumber(item.monthInput));
    const started = readNumber('cost-production-started');
    const finished = readNumber('cost-production-finished');
    const sales = readNumber('cost-sales');
    const monthInput = document.getElementById('cost-month-name');
    const monthRaw = monthInput ? monthInput.value.trim() : '';
    const monthLabel = monthRaw ? `MES DE ${monthRaw.toUpperCase()}` : 'MES EN CURSO';
    const monthSlug = monthRaw ? sanitizeFileName(monthRaw) : '';

    costReportMeta.monthLabel = monthLabel;
    costReportMeta.fileLabel = monthSlug || 'mes-en-curso';

    document.querySelectorAll('[data-month-label]').forEach(el => {
      el.textContent = monthLabel;
    });

    const exceedsProduction = finished > started;
    if (warningEl) {
      warningEl.style.display = exceedsProduction ? '' : 'none';
    }

    const inProcessUnits = exceedsProduction ? 0 : Math.max(started - finished, 0);

    const summaryBody = document.getElementById('cost-summary-body');
    if (summaryBody) {
      summaryBody.innerHTML = '';
      COST_ELEMENTS.forEach((element, index) => {
        const cost = Number.isFinite(monthlyCosts[index]) ? monthlyCosts[index] : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${element.label}</td>
          <td>${formatCurrency(cost)}</td>
        `;
        summaryBody.appendChild(tr);
      });
    }

    const summaryTotal = monthlyCosts.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
    const summaryTotalCell = document.getElementById('cost-summary-total');
    if (summaryTotalCell) {
      summaryTotalCell.textContent = formatCurrency(summaryTotal);
    }

    const finishedData = updateProductionTable('cost-finished-body', 'cost-finished-total', finished, unitCosts);
    const processData = updateProductionTable('cost-process-body', 'cost-process-total', inProcessUnits, unitCosts);
    updateProductionTable('cost-sales-body', 'cost-sales-total', sales, unitCosts);

    const estimatedTotals = COST_ELEMENTS.map((_, index) => {
      const finishedTotal = finishedData?.rows?.[index]?.total ?? 0;
      const processTotal = processData?.rows?.[index]?.total ?? 0;
      return finishedTotal + processTotal;
    });

    const varianceBody = document.getElementById('cost-variance-body');
    const coefficientBody = document.getElementById('cost-coefficient-body');
    const rectificationBody = document.getElementById('cost-rectification-body');
    const correctedUnitCosts = COST_ELEMENTS.map(() => 0);

    const totals = {
      estimated: 0,
      real: 0,
      diff: 0,
    };

    if (varianceBody) {
      varianceBody.innerHTML = '';
    }

    if (coefficientBody) {
      coefficientBody.innerHTML = '';
    }
    if (rectificationBody) {
      rectificationBody.innerHTML = '';
    }

    COST_ELEMENTS.forEach((element, index) => {
      const estimated = Number.isFinite(estimatedTotals[index]) ? estimatedTotals[index] : 0;
      const real = Number.isFinite(monthlyCosts[index]) ? monthlyCosts[index] : 0;
      const variation = real - estimated;
      const status = getVariationStatus(variation);
      const unitEstimated = Number.isFinite(unitCosts[index]) ? unitCosts[index] : 0;

      totals.estimated += estimated;
      totals.real += real;
      totals.diff += variation;

      if (varianceBody) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${element.label}</td>
          <td>${formatCurrency(estimated)}</td>
          <td>${formatCurrency(real)}</td>
          <td>${formatCurrency(variation)}</td>
          <td><span class="status ${status.className}">${status.label}</span></td>
        `;
        varianceBody.appendChild(row);
      }

      const coefficient = estimated !== 0 ? variation / estimated : 0;
      const correctionFigure = unitEstimated * coefficient;
      const correctedUnit = unitEstimated + correctionFigure;
      correctedUnitCosts[index] = correctedUnit;

      if (coefficientBody) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${element.label}</td>
          <td>${formatCurrency(variation)}</td>
          <td>${formatCurrency(estimated)}</td>
          <td>${formatCoefficient(coefficient)}</td>
          <td><span class="status ${status.className}">${status.label}</span></td>
        `;
        coefficientBody.appendChild(row);
      }

      if (rectificationBody) {
        const rectRow = document.createElement('tr');
        rectRow.innerHTML = `
          <td>${element.label}</td>
          <td>${formatCurrency(unitEstimated)}</td>
          <td>${formatCoefficient(coefficient)}</td>
          <td>${formatCurrency(correctionFigure)}</td>
          <td>${formatCurrency(correctedUnit)}</td>
        `;
        rectificationBody.appendChild(rectRow);
      }
    });

    const totalEstimatedEl = document.getElementById('cost-variance-total-estimated');
    const totalRealEl = document.getElementById('cost-variance-total-real');
    const totalDiffEl = document.getElementById('cost-variance-total-diff');
    const totalTypeEl = document.getElementById('cost-variance-total-type');

    if (totalEstimatedEl) totalEstimatedEl.textContent = formatCurrency(totals.estimated);
    if (totalRealEl) totalRealEl.textContent = formatCurrency(totals.real);
    if (totalDiffEl) totalDiffEl.textContent = formatCurrency(totals.diff);
    if (totalTypeEl) {
      const totalStatus = getVariationStatus(totals.diff);
      totalTypeEl.innerHTML = `<span class="status ${totalStatus.className}">${totalStatus.label}</span>`;
    }

    const finishedInventoryUnits = finished - sales;

    const finishedAdjust = updateAdjustmentTable(
      'cost-adjust-finished-body',
      finishedInventoryUnits,
      unitCosts,
      correctedUnitCosts,
      {
        estimated: 'cost-adjust-finished-estimated-total',
        corrected: 'cost-adjust-finished-corrected-total',
        adjustment: 'cost-adjust-finished-adjustment-total',
      }
    );

    const processAdjust = updateAdjustmentTable(
      'cost-adjust-process-body',
      inProcessUnits,
      unitCosts,
      correctedUnitCosts,
      {
        estimated: 'cost-adjust-process-estimated-total',
        corrected: 'cost-adjust-process-corrected-total',
        adjustment: 'cost-adjust-process-adjustment-total',
      }
    );

    const salesAdjust = updateAdjustmentTable(
      'cost-adjust-sales-body',
      sales,
      unitCosts,
      correctedUnitCosts,
      {
        estimated: 'cost-adjust-sales-estimated-total',
        corrected: 'cost-adjust-sales-corrected-total',
        adjustment: 'cost-adjust-sales-adjustment-total',
      }
    );

    updateAdjustmentSummary([
      { label: 'Ajuste del costo de existencia de la producción terminada', adjustments: finishedAdjust.adjustments },
      { label: 'Ajuste del costo de la producción en proceso', adjustments: processAdjust.adjustments },
      { label: 'Ajuste del costo de la producción vendida', adjustments: salesAdjust.adjustments },
    ]);

    const stats = [
      { id: 'cost-summary-started', value: started },
      { id: 'cost-summary-finished', value: finished },
      { id: 'cost-summary-process', value: inProcessUnits },
      { id: 'cost-summary-sales', value: sales },
    ];

    stats.forEach(({ id, value }) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = `${formatUnits(value)} crepas`;
      }
    });
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('reset', () => {
    setTimeout(update, 0);
  });

  update();
}

function showView(hash) {
  const { user } = getAuth();
  const view = viewMap[hash] || viewMap['#perfil'];
  
  // Verificar si la vista es solo para administradores
  if (view.adminOnly && user.role !== 'admin') {
    hash = '#perfil'; // Redirigir a perfil si no es admin
    history.replaceState(null, '', hash);
  }

  [...menu.querySelectorAll('a')].forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });

  Object.values(viewMap).forEach(v => {
    const el = document.querySelector(v.el);
    if (el) el.style.display = 'none';
  });

  const targetView = viewMap[hash] || viewMap['#perfil'];
  const el = document.querySelector(targetView.el);
  if (el) el.style.display = '';

  title.innerHTML = `<i class="fas ${targetView.icon}"></i> ${targetView.title}`;

  // Cargar datos específicos de la vista
  if (hash === '#usuarios') {
    loadUsers();
  } else if (hash === '#productos') {
    loadProducts();
  } else if (hash === '#costos') {
    initCostCalculator();
  } else if (hash === '#pedidos') {
    loadOrders();
  } else if (hash === '#config') {
    initConfig();
  }
}

// Manejo de clicks en menú
menu.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  const hash = a.getAttribute('href');
  history.replaceState(null, '', hash);
  showView(hash);
});

// Manejo de botones editar perfil
const btnEdit = document.getElementById('btn-perfil-editar');
const form = document.getElementById('form-perfil');
const view = document.getElementById('view-perfil');
const btnCancel = document.getElementById('perfil-cancelar');

btnEdit.addEventListener('click', () => {
  view.style.display = 'none';
  form.style.display = '';
  const { user } = getAuth();
  if (user) {
    document.getElementById('perfil-nombre').value = user.name || '';
    document.getElementById('perfil-email').value = user.email || '';
    document.getElementById('perfil-telefono').value = user.phone || '';
    document.getElementById('perfil-direccion').value = user.address || '';
  }
});

btnCancel.addEventListener('click', () => {
  form.style.display = 'none';
  view.style.display = '';
});

// Guardar cambios perfil
form.addEventListener('submit', async e => {
  e.preventDefault();

  const { token, user } = getAuth();
  
  const updatedUser = {
    ...user,
    name: document.getElementById('perfil-nombre').value.trim(),
    email: document.getElementById('perfil-email').value.trim(),
    phone: document.getElementById('perfil-telefono').value.trim(),
    address: document.getElementById('perfil-direccion').value.trim(),
  };

  try {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedUser)
    });

    if (res.ok) {
      const result = await res.json();
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      loadProfile(result.user);
      
      form.style.display = 'none';
      view.style.display = '';
      alert('Perfil actualizado correctamente');
    } else {
      alert('Error al actualizar el perfil');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error al actualizar el perfil');
  }
});

// Cargar usuarios desde la API
async function loadUsers() {
  const { token } = getAuth();
  try {
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const users = await res.json();
      const tbody = document.getElementById('tbl-usuarios-body');
      tbody.innerHTML = '';
      
      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${user.id}</td>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.phone || 'N/A'}</td>
          <td><span class="status ${user.role === 'admin' ? 'ok' : 'customer'}">${user.role}</span></td>
          <td class="action-buttons">
            <button class="btn-icon" data-action="edit-user" data-id="${user.id}" title="Editar usuario">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" data-action="delete-user" data-id="${user.id}" title="Eliminar usuario">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      console.error('Error al cargar usuarios');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Cargar productos desde la API
async function loadProducts() {
  const { token } = getAuth();
  try {
    const res = await fetch('/api/products', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const products = await res.json();
      const tbody = document.getElementById('tbl-productos-body');
      tbody.innerHTML = '';
      
      products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${product.id}</td>
          <td>${product.name}</td>
          <td>Q${product.price}</td>
          <td>${product.stock}</td>
          <td><span class="status ${product.active ? 'ok' : ''}">${product.active ? 'sí' : 'no'}</span></td>
          <td class="action-buttons">
            <button class="btn-icon" data-action="edit-prod" data-id="${product.id}" title="Editar producto">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" data-action="delete-prod" data-id="${product.id}" title="Eliminar producto">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      console.error('Error al cargar productos');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Cargar pedidos desde la API (solo lectura para todos)
async function loadOrders() {
  const { token, user } = getAuth();
  
  try {
    let url = '/api/orders';
    
    // Si no es admin, cargar solo los pedidos del usuario actual
    if (user.role !== 'admin') {
      url = `/api/user/orders`;
    }
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const orders = await res.json();
      const tbody = document.getElementById('tbl-pedidos-body');
      tbody.innerHTML = '';
      
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pedidos registrados</td></tr>';
        return;
      }
      
      orders.forEach(order => {
        const tr = document.createElement('tr');
        const orderDate = new Date(order.created_at).toLocaleDateString();
        
        // Definir clases según el estado (consistentes con usuarios y productos)
        let statusClass = '';
        let statusText = '';
        
        switch (order.status) {
          case 'pending':
            statusClass = 'pending';
            statusText = 'pendiente';
            break;
          case 'paid':
            statusClass = 'pagado';
            statusText = 'pagado';
            break;
          case 'cancelled':
            statusClass = 'error';
            statusText = 'cancelado';
            break;
          case 'completed':
            statusClass = 'ok';
            statusText = 'completado';
            break;
          default:
            statusClass = '';
            statusText = order.status;
        }
        
        tr.innerHTML = `
          <td>${order.id}</td>
          <td>${orderDate}</td>
          <td>Q${order.total}</td>
          <td><span class="status ${statusClass}">${statusText}</span></td>
          <td>
            <button class="btn-icon" data-action="view-order" data-id="${order.id}" title="Ver detalles">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      console.error('Error al cargar pedidos');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Crear modal de edición
function createEditModal() {
  const modal = document.createElement('div');
  modal.id = 'edit-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <h2 id="modal-title">Editar</h2>
      <form id="modal-form">
        <div id="modal-fields"></div>
        <div class="modal-actions">
          <button type="button" class="btn-soft" id="modal-cancel">Cancelar</button>
          <button type="submit" class="btn-soft">Guardar</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners para el modal
  modal.querySelector('.close').addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel').addEventListener('click', closeModal);
  modal.querySelector('#modal-form').addEventListener('submit', handleModalSubmit);
  
  return modal;
}

// Abrir modal
function openModal(title, fields, onSubmit, editId = null, editType = null) {
  const modal = document.getElementById('edit-modal') || createEditModal();
  const modalTitle = modal.querySelector('#modal-title');
  const modalFields = modal.querySelector('#modal-fields');
  
  modalTitle.textContent = title;
  modalFields.innerHTML = '';
  
  // Crear campos del formulario
  fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = field.label;
    label.htmlFor = field.name;
    
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        if (option.value === field.value) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.value = field.value || '';
      if (field.rows) input.rows = field.rows;
      if (field.readonly) input.readOnly = true;
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      if (field.type !== 'file') {
        input.value = field.value || '';
      }
      if (field.readonly) input.readOnly = true;
      if (field.accept) input.accept = field.accept;
    }
    
    input.id = `modal-${field.name}`;
    input.name = field.name;
    input.required = field.required || false;
    
    div.appendChild(label);
    div.appendChild(input);
    modalFields.appendChild(div);
  });
  
  // Guardar la función de submit y datos de edición
  currentOnSubmit = onSubmit;
  currentEditId = editId;
  currentEditType = editType;
  
  modal.style.display = 'block';
}

// Cerrar modal
function closeModal() {
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentOnSubmit = null;
  currentEditId = null;
  currentEditType = null;
}

// Manejar envío del formulario del modal
async function handleModalSubmit(e) {
  e.preventDefault();
  
  if (!currentOnSubmit) {
    closeModal();
    return;
  }
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  try {
    await currentOnSubmit(data, currentEditId, currentEditType);
    closeModal();
  } catch (error) {
    console.error('Error al procesar formulario:', error);
    alert('Error al procesar el formulario');
  }
}

// Botones de acción para tablas
document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action^="edit-"], [data-action^="delete-"], [data-action^="view-"]');
  if (!btn) return;
  e.preventDefault();

  const { user } = getAuth();
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  // Verificar permisos para acciones de administración
  if ((action.includes('edit-') || action.includes('delete-')) && user.role !== 'admin') {
    alert('Acceso denegado: solo administradores pueden realizar esta acción.');
    return;
  }

  try {
    if (action === 'edit-user') {
      editUser(id);
    } else if (action === 'delete-user') {
      if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
        await deleteUser(id);
        loadUsers();
      }
    } else if (action === 'edit-prod') {
      editProduct(id);
    } else if (action === 'delete-prod') {
      if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        await deleteProduct(id);
        loadProducts();
      }
    } else if (action === 'view-order') {
      viewOrder(id);
    }
  } catch (error) {
    console.error('Error al procesar acción:', error);
    alert('Error al procesar la acción');
  }
});

// Funciones para manipular usuarios
const btnAddUser = document.getElementById('btn-add-user');
if (btnAddUser) {
  btnAddUser.addEventListener('click', () => addUser());
}

async function addUser() {
  const { token } = getAuth();

  openModal(
    'Agregar Usuario',
    [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Contraseña', type: 'password', required: true },
      {
        name: 'role',
        label: 'Rol',
        type: 'select',
        value: 'customer',
        options: [
          { value: 'admin', text: 'Administrador' },
          { value: 'customer', text: 'Cliente' }
        ],
        required: true
      },
      { name: 'phone', label: 'Teléfono', type: 'text' },
      { name: 'address', label: 'Dirección', type: 'text' }
    ],
    async (data) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert('Usuario creado correctamente');
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Error al crear el usuario');
      }
    }
  );
}

async function editUser(userId) {
  const { token } = getAuth();
  
  try {
    // Obtener datos del usuario
    const res = await fetch(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const user = await res.json();
      
      // Mostrar modal de edición
      openModal(
        'Editar Usuario',
        [
          { name: 'name', label: 'Nombre', type: 'text', value: user.name, required: true },
          { name: 'email', label: 'Email', type: 'email', value: user.email, required: true },
          { 
            name: 'role', 
            label: 'Rol', 
            type: 'select', 
            value: user.role, 
            options: [
              { value: 'admin', text: 'Administrador' },
              { value: 'customer', text: 'Cliente' }
            ],
            required: true 
          },
          { name: 'phone', label: 'Teléfono', type: 'text', value: user.phone || '' },
          { name: 'address', label: 'Dirección', type: 'text', value: user.address || '' }
        ],
        async (data) => {
          const updateRes = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
          });
          
          if (updateRes.ok) {
            alert('Usuario actualizado correctamente');
            loadUsers();
          } else {
            throw new Error('Error al actualizar el usuario');
          }
        },
        userId,
        'user'
      );
    }
  } catch (error) {
    console.error('Error al editar usuario:', error);
    alert('Error al editar el usuario');
  }
}

async function deleteUser(userId) {
  const { token } = getAuth();
  
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      alert('Usuario eliminado correctamente');
    } else {
      alert('Error al eliminar el usuario');
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    alert('Error al eliminar el usuario');
  }
}

// Funciones para manipular productos
const btnAddProduct = document.getElementById('btn-add-product');
if (btnAddProduct) {
  btnAddProduct.addEventListener('click', () => addProduct());
}

async function addProduct() {
  const { token } = getAuth();

  // Obtener categorías para el select
  let categories = [];
  try {
    const catRes = await fetch('/api/categories', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (catRes.ok) {
      categories = await catRes.json();
    }
  } catch (err) {
    console.error('Error al cargar categorías:', err);
  }

  openModal(
    'Agregar Producto',
    [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'price', label: 'Precio', type: 'number', required: true },
      { name: 'stock', label: 'Stock', type: 'number', required: true },
      {
        name: 'category_id',
        label: 'Categoría',
        type: 'select',
        options: [
          { value: '', text: 'Seleccionar categoría' },
          ...categories.map(cat => ({ value: cat.id, text: cat.name }))
        ]
      },
      { name: 'image', label: 'Imagen', type: 'file', required: true, accept: 'image/*' }
    ],
    async (data) => {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      formData.append('price', data.price);
      formData.append('stock', data.stock);
      if (data.category_id) formData.append('category_id', data.category_id);
      if (data.image) formData.append('image', data.image);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        alert('Producto creado correctamente');
        loadProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Error al crear el producto');
      }
    }
  );
}

async function editProduct(productId) {
  const { token } = getAuth();
  
  try {
    // Obtener datos del producto
    const res = await fetch(`/api/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const product = await res.json();
      
      // Obtener categorías para el select
      const categoriesRes = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      let categories = [];
      
      if (categoriesRes.ok) {
        categories = await categoriesRes.json();
      }
      
      // Mostrar modal de edición
      openModal(
        'Editar Producto',
        [
          { name: 'name', label: 'Nombre', type: 'text', value: product.name, required: true },
          { name: 'price', label: 'Precio', type: 'number', value: product.price, required: true, step: "0.01" },
          { name: 'stock', label: 'Stock', type: 'number', value: product.stock, required: true },
          { name: 'description', label: 'Descripción', type: 'text', value: product.description || '' },
          { 
            name: 'category_id', 
            label: 'Categoría', 
            type: 'select', 
            value: product.category_id || '',
            options: [
              { value: '', text: 'Seleccionar categoría' },
              ...categories.map(cat => ({ value: cat.id, text: cat.name }))
            ]
          }
        ],
        async (data) => {
          const updateRes = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
          });
          
          if (updateRes.ok) {
            alert('Producto actualizado correctamente');
            loadProducts();
          } else {
            throw new Error('Error al actualizar el producto');
          }
        },
        productId,
        'product'
      );
    }
  } catch (error) {
    console.error('Error al editar producto:', error);
    alert('Error al editar el producto');
  }
}

async function deleteProduct(productId) {
  const { token } = getAuth();
  
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      alert('Producto eliminado correctamente');
    } else {
      alert('Error al eliminar el producto');
    }
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    alert('Error al eliminar el producto');
  }
}

// Ver detalles del pedido (solo lectura)
async function viewOrder(orderId) {
  const { token } = getAuth();

  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const order = await res.json();

      const itemsText = order.items
        .map(it => `${it.name} x${it.quantity} - Q${(it.price * it.quantity).toFixed(2)}`)
        .join('\n');

      openModal(
        `Detalles del Pedido #${order.id}`,
        [
          { name: 'customer', label: 'Cliente', type: 'text', value: order.customer.name, readonly: true },
          { name: 'email', label: 'Email', type: 'text', value: order.customer.email, readonly: true },
          { name: 'date', label: 'Fecha', type: 'text', value: new Date(order.created_at).toLocaleDateString(), readonly: true },
          { name: 'status', label: 'Estado', type: 'text', value: order.status, readonly: true },
          { name: 'total', label: 'Total', type: 'text', value: `Q${order.total}`, readonly: true },
          { name: 'items', label: 'Productos', type: 'textarea', value: itemsText, readonly: true, rows: Math.min(order.items.length + 1, 10) }
        ],
        () => {
          const invoiceData = {
            orderId: order.id,
            createdAt: order.created_at,
            customer: {
              name: order.customer.name,
              email: order.customer.email,
              address: order.customer.address || '',
            },
            items: order.items,
          };
          localStorage.setItem('lastOrder', JSON.stringify(invoiceData));
          window.open('/factura.html', '_blank');
        }
      );

      const modal = document.getElementById('edit-modal');
      const submitBtn = modal.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Descargar factura';
    } else {
      alert('Error al obtener detalles del pedido');
    }
  } catch (error) {
    console.error('Error al ver pedido:', error);
    alert('Error al ver detalles del pedido');
  }
}

// Logout
document.getElementById('btn-logout').addEventListener('click', e => {
  e.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login.html';
});

// Inicialización principal
(async function init() {
  const authorized = await checkAuth();
  if (!authorized) return;

  const { user } = getAuth();
  loadProfile(user);

  // Ocultar elementos de administración si no es admin
  if (user.role !== 'admin') {
    // Quitar elementos del menú
    const adminMenuItems = menu.querySelectorAll('a.admin-only');
    adminMenuItems.forEach(item => item.remove());

    // Quitar leyenda de administración
    const adminLegend = document.querySelector('.admin-actions-legend');
    if (adminLegend) adminLegend.remove();

    // Ocultar botones de acción admin en tablas
    const adminButtons = document.querySelectorAll('[data-action^="edit-"], [data-action^="delete-"]');
    adminButtons.forEach(button => button.style.display = 'none');
  }

  // Verificar hash actual y redirigir si es necesario
  const currentView = viewMap[location.hash];
  if (user.role !== 'admin' && currentView?.adminOnly) {
    history.replaceState(null, '', '#perfil');
  }

  showView(location.hash || '#perfil');

  window.addEventListener('popstate', () => {
    showView(location.hash || '#perfil');
  });
})();