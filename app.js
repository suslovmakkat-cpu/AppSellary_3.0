let cachedOperators = [];
let cachedMotivations = [];
const modalStates = {};

function confirmDeletion(message = 'Вы уверены, что хотите удалить запись?') {
    return window.confirm(message);
}

function getModalStateKey(modalId) {
    return `modal_state_${modalId}`;
}

function applyModalState(modalId, content) {
    const saved = localStorage.getItem(getModalStateKey(modalId));
    if (saved) {
        try {
            const state = JSON.parse(saved);
            if (state.width) content.style.width = `${state.width}px`;
            if (state.height) content.style.height = `${state.height}px`;
            if (state.left !== undefined && state.top !== undefined) {
                content.style.left = `${state.left}px`;
                content.style.top = `${state.top}px`;
                content.style.transform = 'none';
            }
        } catch (e) {
            console.warn('Failed to parse modal state', e);
        }
    } else {
        const defaultWidth = Math.min(700, window.innerWidth * 0.9);
        const defaultHeight = Math.min(600, window.innerHeight * 0.9);
        content.style.width = `${defaultWidth}px`;
        content.style.left = `${(window.innerWidth - defaultWidth) / 2}px`;
        content.style.top = `${(window.innerHeight - defaultHeight) / 2}px`;
    }
}

function saveModalState(modalId, content) {
    const rect = content.getBoundingClientRect();
    modalStates[modalId] = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
    };
    localStorage.setItem(getModalStateKey(modalId), JSON.stringify(modalStates[modalId]));
}

function enableModalInteractions(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    const header = modal.querySelector('.modal-header');
    if (!content || !header) return;

    content.style.position = 'absolute';
    applyModalState(modalId, content);

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    content.appendChild(handle);

    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragOffset = { x: e.clientX - content.offsetLeft, y: e.clientY - content.offsetTop };
        content.classList.add('dragging');
    });

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        dragOffset = { x: content.offsetWidth - e.clientX, y: content.offsetHeight - e.clientY };
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const left = e.clientX - dragOffset.x;
            const top = e.clientY - dragOffset.y;
            content.style.left = `${Math.max(10, left)}px`;
            content.style.top = `${Math.max(10, top)}px`;
        } else if (isResizing) {
            const width = e.clientX + dragOffset.x - content.offsetLeft;
            const height = e.clientY + dragOffset.y - content.offsetTop;
            if (width > 400) content.style.width = `${width}px`;
            if (height > 300) content.style.height = `${height}px`;
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
            saveModalState(modalId, content);
        }
        isDragging = false;
        isResizing = false;
        content.classList.remove('dragging');
    });
}

function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    const target = document.getElementById(sectionName);
    if (target) {
        target.style.display = 'block';
    }
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        const titles = {
            dashboard: 'Дашборд',
            operators: 'Операторы',
            calculations: 'Расчеты ЗП',
            payments: 'Выплаты',
            corrections: 'Корректировка расчетов',
            settings: 'Настройки'
        };
        pageTitle.textContent = titles[sectionName] || 'Дашборд';
    }
    if (sectionName === 'corrections') loadCorrections();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showSettingsTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.getElementById(`settings${tabName.charAt(0).toUpperCase()}${tabName.slice(1)}`);
    if (targetTab) targetTab.classList.add('active');
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const tabs = {
        main: 0,
        motivation: 1,
        trash: 2
    };
    const tabIndex = tabs[tabName];
    if (tabIndex !== undefined) {
        const tabEl = document.querySelectorAll('.tab')[tabIndex];
        if (tabEl) tabEl.classList.add('active');
    }
    if (tabName === 'motivation') loadMotivations();
    if (tabName === 'trash') loadTrash();
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

function showNotifications() {
    alert('Уведомления - функция в разработке');
}

function showOperatorModal() {
    document.getElementById('operatorId').value = '';
    document.getElementById('operatorName').value = '';
    document.getElementById('operatorTaxBonus').value = '0';
    document.getElementById('operatorStatus').value = '1';
    document.getElementById('operatorMotivation').value = '';
    applyModalState('operatorModal', document.querySelector('#operatorModal .modal-content'));
    document.getElementById('operatorModal').style.display = 'block';
}

async function saveOperator() {
    const operatorId = document.getElementById('operatorId').value;
    const payload = {
        name: document.getElementById('operatorName').value,
        tax_bonus: parseFloat(document.getElementById('operatorTaxBonus').value) || 0,
        is_active: parseInt(document.getElementById('operatorStatus').value, 10),
        motivation_id: document.getElementById('operatorMotivation').value || null
    };
    if (!payload.name) {
        alert('Введите ФИО оператора');
        return;
    }
    const url = operatorId ? `/api/operators/${operatorId}` : '/api/operators';
    const method = operatorId ? 'PUT' : 'POST';
    await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    closeModal('operatorModal');
    loadOperators();
    loadDashboard();
}

async function editOperator(operatorId) {
    const response = await fetch(`/api/operators/${operatorId}`);
    const operator = await response.json();
    document.getElementById('operatorId').value = operator.id;
    document.getElementById('operatorName').value = operator.name;
    document.getElementById('operatorTaxBonus').value = operator.tax_bonus || 0;
    document.getElementById('operatorStatus').value = operator.is_active;
    document.getElementById('operatorMotivation').value = operator.motivation_id || '';
    applyModalState('operatorModal', document.querySelector('#operatorModal .modal-content'));
    document.getElementById('operatorModal').style.display = 'block';
}

function autoCalculateQuartet(kcField, nonKcField, salesField, percentField) {
    const parseVal = (field) => {
        if (!field) return null;
        const val = parseFloat(field.value);
        return isNaN(val) ? null : val;
    };

    let kcVal = parseVal(kcField);
    let nonKcVal = parseVal(nonKcField);
    let salesVal = parseVal(salesField);
    let percentVal = parseVal(percentField);

    const provided = [kcVal, nonKcVal, salesVal, percentVal].filter(v => v !== null).length;

    if (provided >= 2) {
        if (kcVal !== null && salesVal !== null) {
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (kcVal !== null && nonKcVal !== null) {
            salesVal = kcVal + nonKcVal;
        } else if (salesVal !== null && nonKcVal !== null) {
            kcVal = Math.max(salesVal - nonKcVal, 0);
        } else if (salesVal !== null && percentVal !== null) {
            kcVal = salesVal * percentVal / 100;
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (kcVal !== null && percentVal !== null && percentVal !== 0) {
            salesVal = kcVal * 100 / percentVal;
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (nonKcVal !== null && percentVal !== null && percentVal < 100) {
            salesVal = nonKcVal * 100 / (100 - percentVal);
            kcVal = Math.max(salesVal - nonKcVal, 0);
        }
    } else if (provided === 1) {
        if (salesVal !== null) {
            kcVal = salesVal;
            nonKcVal = 0;
        } else if (kcVal !== null) {
            salesVal = kcVal;
            nonKcVal = 0;
        } else if (nonKcVal !== null) {
            salesVal = nonKcVal;
            kcVal = 0;
        }
    }

    if (salesVal !== null && kcVal !== null) {
        nonKcVal = Math.max(salesVal - kcVal, 0);
    }

    kcVal = kcVal === null ? 0 : kcVal;
    nonKcVal = nonKcVal === null ? 0 : nonKcVal;
    salesVal = salesVal === null ? kcVal + nonKcVal : salesVal;
    percentVal = salesVal > 0 ? (kcVal / salesVal) * 100 : 0;

    const activeElement = document.activeElement;
    if (kcField && activeElement !== kcField) kcField.value = kcVal.toFixed(2);
    if (nonKcField && activeElement !== nonKcField) nonKcField.value = nonKcVal.toFixed(2);
    if (salesField && activeElement !== salesField) salesField.value = salesVal.toFixed(2);
    if (percentField && activeElement !== percentField) percentField.value = percentVal.toFixed(1);
}

function deriveAmounts() {
    autoCalculateQuartet(
        document.getElementById('kcAmount'),
        document.getElementById('nonKcAmount'),
        document.getElementById('salesAmount'),
        document.getElementById('kcPercent')
    );
}

function deriveCorrectionAmounts() {
    autoCalculateQuartet(
        document.getElementById('correctionKcAmount'),
        document.getElementById('correctionNonKcAmount'),
        document.getElementById('correctionSalesAmount'),
        document.getElementById('correctionKcPercent')
    );
}

function setCalculationEditingState(calculationId) {
    const actionBtn = document.getElementById('calcActionButton');
    const cancelBtn = document.getElementById('cancelCalcEdit');
    const calcIdField = document.getElementById('calcEditingId');
    if (!calcIdField) return;

    calcIdField.value = calculationId || '';
    if (calculationId) {
        if (actionBtn) actionBtn.innerHTML = '<i>💾</i> Сохранить изменения';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
    } else {
        if (actionBtn) actionBtn.innerHTML = '<i>🧮</i> Рассчитать ЗП';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

function cancelCalculationEdit() {
    const calcIdField = document.getElementById('calcEditingId');
    if (calcIdField) {
        calcIdField.value = '';
    }
    setCalculationEditingState(null);
    document.getElementById('calculationResult').innerHTML = '';
}

async function calculateSalary(event) {
    if (event) event.preventDefault();
    const operatorId = document.getElementById('calcOperator').value;
    if (!operatorId) {
        alert('Выберите оператора');
        return;
    }
    deriveAmounts();
    const payload = {
        operator_id: parseInt(operatorId, 10),
        kc_amount: parseFloat(document.getElementById('kcAmount').value) || 0,
        non_kc_amount: parseFloat(document.getElementById('nonKcAmount').value) || 0,
        sales_amount: parseFloat(document.getElementById('salesAmount').value) || 0,
        redemption_percent: parseFloat(document.getElementById('kcPercent').value) || null,
        additional_bonus: parseFloat(document.getElementById('additionalBonus').value) || 0,
        penalty_amount: parseFloat(document.getElementById('penaltyAmount').value) || 0,
        period_start: document.getElementById('calcPeriodStart').value,
        period_end: document.getElementById('calcPeriodEnd').value,
        working_days_in_period: parseFloat(document.getElementById('workingDaysInPeriod').value) || 0,
        comment: document.getElementById('calcComment').value,
        motivation_override_id: document.getElementById('calcMotivationOverride').value || null,
        bonus_percent_salary: parseFloat(document.getElementById('bonusPercentSalary').value) || 0,
        bonus_percent_sales: parseFloat(document.getElementById('bonusPercentSales').value) || 0,
        include_redemption_percent: document.getElementById('includeRedemption').checked
    };
    const calcIdField = document.getElementById('calcEditingId');
    const isEditing = calcIdField && calcIdField.value;
    const url = isEditing ? `/api/calculations/${calcIdField.value}` : '/api/calculate';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.error) {
        alert(`Ошибка: ${result.error}`);
        return;
    }
    const summary = document.getElementById('calculationResult');
    if (summary) {
        const planLine = result.plan_target && result.plan_target > 0 ? `<div>Выполнение плана: ${(result.plan_completion * 100).toFixed(1)}%</div>` : '';
        const taxLine = result.motivation_tax_bonus ? `<div>Налоговый бонус: ${result.motivation_tax_bonus.toLocaleString('ru-RU')} руб.</div>` : '';
        const steps = (result.detailed_breakdown || []).map(step => `<li>${step}</li>`).join('');
        summary.innerHTML = `
            <div class="alert alert-success">
                <div><strong>Итоговая ЗП: ${result.total_salary.toLocaleString('ru-RU')} руб.</strong></div>
                <div>Процент выкупа: ${result.redemption_percent ? result.redemption_percent.toFixed(1) : '0.0'}%</div>
                <div>Используемая мотивация: ${result.applied_motivation || 'по умолчанию'}</div>
                ${planLine}
                ${taxLine}
                ${steps ? `<hr><div>Детализация расчета:</div><ol>${steps}</ol>` : ''}
            </div>`;
    }
    if (isEditing) {
        setCalculationEditingState(null);
    }
    loadCalculations();
    loadPayments();
}

async function loadOperators() {
    const response = await fetch('/api/operators');
    cachedOperators = await response.json();
    const operatorsTable = document.getElementById('operatorsTable');
    const calcOperator = document.getElementById('calcOperator');
    const operatorMotivation = document.getElementById('operatorMotivation');
    if (operatorsTable) {
        operatorsTable.innerHTML = cachedOperators.map(op => {
            const motivation = cachedMotivations.find(m => `${m.id}` === `${op.motivation_id}`);
            const motivationTitle = motivation ? motivation.name : '—';
            return `
            <tr>
                <td>${op.name}</td>
                <td>${op.tax_bonus ? `${op.tax_bonus}%` : '—'}</td>
                <td>${op.is_active ? '✅ Активен' : '❌ Неактивен'}</td>
                <td>${motivationTitle}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editOperator(${op.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="trashOperator(${op.id})">🗑️</button>
                </td>
            </tr>
        `;
        }).join('');
    }
    if (calcOperator) {
        calcOperator.innerHTML = `<option value=''>Выберите оператора</option>` +
            cachedOperators.map(op => `<option value='${op.id}'>${op.name}</option>`).join('');
    }
    if (operatorMotivation && cachedMotivations) {
        operatorMotivation.innerHTML = `<option value=''>Не выбрано</option>` +
            cachedMotivations.filter(m => m.is_deleted === 0 && m.is_active === 1).map(m => `<option value='${m.id}'>${m.name}</option>`).join('');
    }
    const dashboardOperator = document.getElementById('dashboardOperator');
    if (dashboardOperator) {
        dashboardOperator.innerHTML = `<option value=''>Все операторы</option>` + cachedOperators.map(op => `<option value='${op.id}'>${op.name}</option>`).join('');
    }
}

async function trashOperator(operatorId) {
    if (!confirmDeletion('Удалить оператора?')) return;
    await fetch(`/api/trash/operator/${operatorId}`, { method: 'POST' });
    loadOperators();
}

async function loadCalculations() {
    const response = await fetch('/api/calculations');
    const calculations = await response.json();
    const table = document.getElementById('calculationsTable');
    const formatDate = (val) => {
        if (!val) return '—';
        const parsed = new Date(val);
        return isNaN(parsed) ? val : parsed.toLocaleDateString('ru-RU');
    };
    if (table) {
        table.innerHTML = calculations.map(calc => {
            const calcDate = formatDate(calc.calculation_date);
            const periodStart = formatDate(calc.period_start);
            const periodEnd = formatDate(calc.period_end);
            return `<tr>
                <td>${calc.operator_name || ''}</td>
                <td>${periodStart}${periodEnd !== '—' ? ' - ' + periodEnd : ''}</td>
                <td>${(calc.sales_amount || 0).toLocaleString('ru-RU')} руб.</td>
                <td>${(calc.redemption_percent || 0).toFixed(1)}%</td>
                <td>${(calc.total_salary || 0).toLocaleString('ru-RU')} руб.</td>
                <td>${calc.applied_motivation_name || '—'}</td>
                <td>${calcDate}</td>
                <td>${formatDate(calc.correction_date)}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editCalculation(${calc.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="trashCalculation(${calc.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }
}

async function loadPayments() {
    const response = await fetch('/api/payments');
    const payments = await response.json();
    const table = document.getElementById('paymentsTable');
    if (table) {
        table.innerHTML = payments.map(payment => {
            const paymentDate = payment.calculation_date ? new Date(payment.calculation_date).toLocaleDateString('ru-RU') : '—';
            const paidDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('ru-RU') : '—';
            const correctionDate = payment.correction_date ? new Date(payment.correction_date).toLocaleDateString('ru-RU') : '—';
            return `<tr>
                <td>${payment.operator_name || '—'}</td>
                <td>${payment.period_start || '—'}</td>
                <td>${payment.sales_amount ? payment.sales_amount.toLocaleString('ru-RU') + ' руб.' : '—'}</td>
                <td>${payment.kc_percent ? payment.kc_percent.toFixed(1) + '%' : '—'}</td>
                <td>${payment.total_salary ? payment.total_salary.toLocaleString('ru-RU') + ' руб.' : '0 руб.'}</td>
                <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${payment.is_paid ? 'checked' : ''} onchange="updatePaymentStatus(${payment.id}, this.checked)"> <small>${payment.is_paid ? 'Выплачено' : 'Ожидает'}</small></div></td>
                <td>${paidDate}</td>
                <td>${correctionDate}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewPaymentDetails(${payment.id})">👁️</button>
                    <button class="btn btn-sm btn-warning" onclick="editPayment(${payment.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePayment(${payment.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }
}

async function updatePaymentStatus(paymentId, isPaid) {
    await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid })
    });
    loadPayments();
}

async function loadDashboard() {
    const [calcRes, payRes, opRes] = await Promise.all([
        fetch('/api/calculations?limit=5'),
        fetch('/api/payments'),
        fetch('/api/operators')
    ]);
    const calculations = await calcRes.json();
    const payments = await payRes.json();
    const operators = await opRes.json();
    const dashboardStats = document.getElementById('dashboardStats');
    if (dashboardStats) {
        dashboardStats.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center;">
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #3498db;">${operators.length}</div>
                    <div style="font-size: 14px; color: #666;">Операторов</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #2ecc71;">${calculations.length}</div>
                    <div style="font-size: 14px; color: #666;">Расчетов</div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${payments.length}</div>
                    <div style="font-size: 14px; color: #666;">Выплат</div>
                </div>
            </div>`;
    }
    const activeOperators = document.getElementById('activeOperators');
    if (activeOperators) {
        const activeOps = operators.filter(op => op.is_active !== 0);
        activeOperators.innerHTML = activeOps.length > 0 ? activeOps.map(op => `
            <div style="padding: 8px; margin: 5px 0; background: white; border-radius: 5px; border-left: 4px solid #3498db;">
                <strong>${op.name}</strong><br>
                <small>Налоговый бонус: ${op.tax_bonus || 0}%</small>
            </div>`).join('') : '<div style="text-align: center; padding: 20px; color: #666;">Нет активных операторов</div>';
    }
    const recentPayments = document.getElementById('recentPayments');
    if (recentPayments) {
        const latest = payments.slice(0, 3);
        recentPayments.innerHTML = latest.length > 0 ? latest.map(payment => `
            <div style="padding: 8px; margin: 5px 0; background: white; border-radius: 5px; border-left: 4px solid #2ecc71;">
                <strong>${payment.operator_name}</strong><br>
                <small>${payment.total_salary.toLocaleString('ru-RU')} руб.</small><br>
                <small style="color: #666;">${payment.is_paid ? '✅ Выплачено' : '⏳ Ожидает'}</small>
            </div>`).join('') : '<div style="text-align: center; padding: 20px; color: #666;">Нет данных о выплатах</div>';
    }
    refreshDashboardChart();
}

function renderDashboardChart(labels, values) {
    const container = document.getElementById('dashboardChart');
    if (!container) return;
    const normalizedValues = (labels || []).map((_, idx) => Number(values?.[idx]) || 0);
    if (!labels || labels.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666;">Нет данных для отображения</div>';
        return;
    }
    const maxVal = Math.max(...normalizedValues, 1);
    const bars = labels.map((label, idx) => {
        const height = Math.max((normalizedValues[idx] / maxVal) * 180, 5);
        return `<div style="flex:1; text-align:center;">
            <div style="background:#4e73df; height:${height}px; margin: 0 6px; border-radius:4px;"></div>
            <div style="font-size:12px; margin-top:4px; color:#555;">${label}</div>
        </div>`;
    }).join('');
    container.innerHTML = `<div style="display:flex; align-items:flex-end; height:200px;">${bars}</div>`;
}

async function refreshDashboardChart() {
    const metric = document.getElementById('dashboardMetric')?.value || 'sales';
    const operatorId = document.getElementById('dashboardOperator')?.value || '';
    const period = document.getElementById('dashboardPeriod')?.value || 'week';
    let start = document.getElementById('dashboardStart')?.value;
    let end = document.getElementById('dashboardEnd')?.value;
    const today = new Date();
    if (period !== 'custom') {
        const endDate = today.toISOString().slice(0, 10);
        let startDate = endDate;
        if (period === 'week') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().slice(0, 10);
        } else if (period === 'month') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString().slice(0, 10);
        }
        start = startDate;
        end = endDate;
        if (document.getElementById('dashboardStart')) document.getElementById('dashboardStart').value = startDate;
        if (document.getElementById('dashboardEnd')) document.getElementById('dashboardEnd').value = endDate;
    }
    const params = new URLSearchParams({ metric });
    if (operatorId) params.append('operator_id', operatorId);
    if (start) params.append('start_date', start);
    if (end) params.append('end_date', end);
    try {
        const response = await fetch(`/api/dashboard/series?${params.toString()}`);
        if (!response.ok) throw new Error('Не удалось получить данные графика');
        const raw = await response.json();
        const data = raw && typeof raw === 'object' ? (raw.series || raw) : {};
        const labels = Array.isArray(data.labels) ? data.labels : [];
        const values = Array.isArray(data.values) ? data.values : [];
        renderDashboardChart(labels, values);
    } catch (error) {
        console.error('Ошибка загрузки графика', error);
        const container = document.getElementById('dashboardChart');
        if (container) container.innerHTML = '<div style="text-align:center; color:#e74c3c;">Ошибка загрузки данных графика</div>';
    }
}

async function loadMotivations() {
    const response = await fetch('/api/motivations?include_deleted=false');
    cachedMotivations = await response.json();
    const table = document.getElementById('motivationsTable');
    const calcSelect = document.getElementById('calcMotivationOverride');
    const summarizeBlocks = (configJson) => {
        try {
            const cfg = JSON.parse(configJson || '{}');
            const blocks = cfg.blocks || [];
            if (!blocks.length) return 'Блоки не заданы';
            const summary = blocks.map(b => {
                const mode = b.apply_mode === 'one_of' ? 'один из' : 'совместно';
                const titles = {
                    fixed_salary: 'Фикс. оклад',
                    percent_sales: '% от продаж',
                    percent_redeemed: '% от выкупленных',
                    progressive_redemption: 'Прогрессия выкупа',
                    fixed_bonus: 'Фикс. бонус',
                    percentage_bonus: '% бонус',
                    sales_plan: 'План продаж',
                };
                return `${titles[b.type] || 'Блок'} (${mode})`;
            }).join(', ');
            return summary;
        } catch (e) {
            return 'Ошибка конфигурации';
        }
    };
    if (table) {
        table.innerHTML = cachedMotivations.map(m => `
            <tr>
                <td>${m.name}</td>
                <td>${m.description || ''}</td>
                <td>${summarizeBlocks(m.config_json)}</td>
                <td>${m.is_active ? 'Активна' : 'Выключена'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editMotivation(${m.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="trashMotivation(${m.id})">🗑️</button>
                </td>
            </tr>`).join('');
    }
    if (calcSelect) {
        calcSelect.innerHTML = `<option value="">По умолчанию из оператора</option>` +
            cachedMotivations.filter(m => m.is_deleted === 0 && m.is_active === 1).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
    loadOperators();
}

function createRangeRow(rangeContainer, range = { from: 0, to: '', percent: 0 }) {
    const row = document.createElement('div');
    row.className = 'bonus-level';
    row.innerHTML = `
        <input type="number" placeholder="От %" value="${range.from ?? 0}" step="0.1" class="form-control" style="width: 90px;">
        <input type="number" placeholder="До %" value="${range.to ?? ''}" step="0.1" class="form-control" style="width: 90px;">
        <input type="number" placeholder="% для диапазона" value="${range.percent ?? 0}" step="0.1" class="form-control" style="width: 140px;">
        <button class="btn btn-sm btn-danger" type="button">✖</button>
    `;
    row.querySelector('button').addEventListener('click', () => row.remove());
    rangeContainer.appendChild(row);
}

function renderBlockFields(container, type, preset = {}) {
    container.innerHTML = '';
    if (type === 'fixed_salary') {
        container.innerHTML = `<input type="number" class="form-control" placeholder="Месячный оклад" value="${preset.monthly_amount ?? ''}" step="0.01">`;
    } else if (type === 'percent_sales' || type === 'percent_redeemed' || type === 'percentage_bonus') {
        container.innerHTML = `<input type="number" class="form-control" placeholder="Процент" value="${preset.percent ?? ''}" step="0.1">`;
    } else if (type === 'fixed_bonus') {
        container.innerHTML = `<input type="number" class="form-control" placeholder="Сумма" value="${preset.amount ?? ''}" step="0.01">`;
    } else if (type === 'sales_plan') {
        container.innerHTML = `
            <input type="number" class="form-control" placeholder="План продаж" value="${preset.plan_value ?? ''}" step="0.01">
            <select class="form-control">
                <option value="monthly" ${preset.plan_period === 'weekly' ? '' : 'selected'}>Месячный</option>
                <option value="weekly" ${preset.plan_period === 'weekly' ? 'selected' : ''}>Недельный</option>
            </select>
        `;
    } else if (type === 'progressive_redemption') {
        const rangesWrapper = document.createElement('div');
        rangesWrapper.className = 'bonus-levels';
        rangesWrapper.style.marginTop = '10px';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-sm btn-secondary';
        addBtn.textContent = 'Добавить диапазон';
        addBtn.addEventListener('click', () => createRangeRow(rangesWrapper));
        container.appendChild(addBtn);
        container.appendChild(rangesWrapper);
        (preset.ranges || []).forEach(r => createRangeRow(rangesWrapper, r));
    }
}

function addMotivationBlock(block = { type: 'fixed_salary', apply_mode: 'together' }) {
    const container = document.getElementById('motivationBlocks');
    if (!container) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'bonus-level';
    const typeSelect = document.createElement('select');
    typeSelect.className = 'form-control';
    typeSelect.style.width = '180px';
    typeSelect.innerHTML = `
        <option value="fixed_salary">Фиксированная зарплата</option>
        <option value="percent_sales">% от продаж</option>
        <option value="percent_redeemed">% от выкупленных</option>
        <option value="progressive_redemption">Прогрессия выкупа</option>
        <option value="fixed_bonus">Фиксированный бонус</option>
        <option value="percentage_bonus">Процентный бонус</option>
        <option value="sales_plan">План продаж</option>
    `;
    typeSelect.value = block.type || 'fixed_salary';

    const modeSelect = document.createElement('select');
    modeSelect.className = 'form-control';
    modeSelect.style.width = '150px';
    modeSelect.innerHTML = `
        <option value="together">Применять вместе</option>
        <option value="one_of">Только один</option>
    `;
    modeSelect.value = block.apply_mode || 'together';

    const fieldsContainer = document.createElement('div');
    fieldsContainer.style.display = 'flex';
    fieldsContainer.style.gap = '10px';
    fieldsContainer.style.flexWrap = 'wrap';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.textContent = '✖';
    removeBtn.addEventListener('click', () => wrapper.remove());

    const rerender = (preset = {}) => renderBlockFields(fieldsContainer, typeSelect.value, preset);
    typeSelect.addEventListener('change', () => rerender({}));

    rerender(block);

    wrapper.appendChild(typeSelect);
    wrapper.appendChild(modeSelect);
    wrapper.appendChild(fieldsContainer);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
}

function collectBlocks() {
    const blocks = [];
    document.querySelectorAll('#motivationBlocks .bonus-level').forEach(row => {
        const selects = row.querySelectorAll('select');
        const typeSelect = selects[0];
        const modeSelect = selects[1];
        const fieldsContainer = row.querySelector('div');
        const type = typeSelect ? typeSelect.value : 'fixed_salary';
        const applyMode = modeSelect ? modeSelect.value : 'together';
        const inputs = fieldsContainer ? fieldsContainer.querySelectorAll('input, select') : [];
        const block = { type, apply_mode: applyMode };

        if (type === 'fixed_salary') {
            block.monthly_amount = parseFloat(inputs[0]?.value) || 0;
        } else if (type === 'percent_sales' || type === 'percent_redeemed' || type === 'percentage_bonus') {
            block.percent = parseFloat(inputs[0]?.value) || 0;
        } else if (type === 'fixed_bonus') {
            block.amount = parseFloat(inputs[0]?.value) || 0;
        } else if (type === 'sales_plan') {
            block.plan_value = parseFloat(inputs[0]?.value) || 0;
            block.plan_period = inputs[1]?.value || 'monthly';
        } else if (type === 'progressive_redemption') {
            const rangesWrapper = fieldsContainer.querySelector('.bonus-levels');
            const ranges = [];
            rangesWrapper?.querySelectorAll('.bonus-level').forEach(rangeRow => {
                const rInputs = rangeRow.querySelectorAll('input');
                const fromVal = parseFloat(rInputs[0]?.value);
                const toValRaw = rInputs[1]?.value;
                const percentVal = parseFloat(rInputs[2]?.value);
                if (!isNaN(fromVal) && !isNaN(percentVal)) {
                    const range = { from: fromVal, percent: percentVal };
                    if (toValRaw !== '') range.to = parseFloat(toValRaw);
                    ranges.push(range);
                }
            });
            block.ranges = ranges;
        }

        const hasValue = Object.keys(block).some(key => {
            if (['type', 'apply_mode', 'plan_period'].includes(key)) return false;
            return block[key];
        });

        if (hasValue) blocks.push(block);
    });
    return blocks;
}

function showMotivationModal(motivation) {
    document.getElementById('motivationId').value = motivation ? motivation.id : '';
    document.getElementById('motivationName').value = motivation ? motivation.name : '';
    document.getElementById('motivationStatus').value = motivation && motivation.is_active === 0 ? '0' : '1';
    document.getElementById('motivationDescription').value = motivation ? (motivation.description || '') : '';
    applyModalState('motivationModal', document.querySelector('#motivationModal .modal-content'));

    const blocksContainer = document.getElementById('motivationBlocks');
    blocksContainer.innerHTML = '';
    if (motivation) {
        try {
            const cfg = JSON.parse(motivation.config_json || '{}');
            (cfg.blocks || []).forEach(b => addMotivationBlock(b));
        } catch (e) {
            addMotivationBlock();
        }
    } else {
        addMotivationBlock();
    }
    document.getElementById('motivationModal').style.display = 'block';
}

async function editMotivation(motivationId) {
    const response = await fetch(`/api/motivations/${motivationId}`);
    const motivation = await response.json();
    showMotivationModal(motivation);
}

async function saveMotivation() {
    const motivationId = document.getElementById('motivationId').value;
    const blocks = collectBlocks();
    const config = JSON.stringify({ blocks });
    const payload = {
        name: document.getElementById('motivationName').value,
        motivation_type: 'composite',
        config_json: config,
        description: document.getElementById('motivationDescription').value,
        is_active: parseInt(document.getElementById('motivationStatus').value, 10)
    };
    const url = motivationId ? `/api/motivations/${motivationId}` : '/api/motivations';
    const method = motivationId ? 'PUT' : 'POST';
    await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    closeModal('motivationModal');
    loadMotivations();
}

async function trashMotivation(motivationId) {
    if (!confirmDeletion('Удалить мотивацию?')) return;
    await fetch(`/api/trash/motivation/${motivationId}`, { method: 'POST' });
    loadMotivations();
}

async function trashCalculation(calculationId) {
    if (!confirmDeletion('Удалить расчет?')) return;
    await fetch(`/api/trash/calculation/${calculationId}`, { method: 'POST' });
    loadCalculations();
    loadTrash();
}

async function loadTrash() {
    const response = await fetch('/api/trash/summary');
    const data = await response.json();
    const renderList = (items, restoreAction, deleteAction, labelFn) => {
        if (!items || items.length === 0) return '<div class="empty">Пусто</div>';
        return items.map(item => `
            <div class="trash-item">
                <div>${labelFn(item)}</div>
                <div>
                    <button class="btn btn-sm btn-primary" onclick="${restoreAction}(${item.id})">↩️</button>
                    <button class="btn btn-sm btn-danger" onclick="${deleteAction}(${item.id})">❌</button>
                </div>
            </div>`).join('');
    };
    document.getElementById('trashOperators').innerHTML = renderList(data.operators, 'restoreOperator', 'deleteOperatorForever', i => i.name);
    document.getElementById('trashPayments').innerHTML = renderList(data.payments, 'restorePayment', 'deletePaymentForever', i => `${i.operator_id} - ${i.total_salary} руб.`);
    document.getElementById('trashCalculations').innerHTML = renderList(data.calculations, 'restoreCalculation', 'deleteCalculationForever', i => `${i.operator_id} - ${i.total_salary} руб.`);
    document.getElementById('trashMotivations').innerHTML = renderList(data.motivations, 'restoreMotivation', 'deleteMotivationForever', i => i.name);
}

async function restoreOperator(id) { await fetch(`/api/trash/operator/${id}/restore`, { method: 'POST' }); loadTrash(); loadOperators(); }
async function restorePayment(id) { await fetch(`/api/trash/payment/${id}/restore`, { method: 'POST' }); loadTrash(); loadPayments(); }
async function restoreCalculation(id) { await fetch(`/api/trash/calculation/${id}/restore`, { method: 'POST' }); loadTrash(); loadCalculations(); }
async function restoreMotivation(id) { await fetch(`/api/trash/motivation/${id}/restore`, { method: 'POST' }); loadTrash(); loadMotivations(); }
async function deleteOperatorForever(id) { if (!confirmDeletion('Удалить оператора навсегда?')) return; await fetch(`/api/trash/operator/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deletePaymentForever(id) { if (!confirmDeletion('Удалить выплату навсегда?')) return; await fetch(`/api/trash/payment/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deleteCalculationForever(id) { if (!confirmDeletion('Удалить расчет навсегда?')) return; await fetch(`/api/trash/calculation/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deleteMotivationForever(id) { if (!confirmDeletion('Удалить мотивацию навсегда?')) return; await fetch(`/api/trash/motivation/${id}/delete`, { method: 'DELETE' }); loadTrash(); }

async function loadCorrections() {
    const response = await fetch('/api/corrections');
    const corrections = await response.json();
    const table = document.getElementById('correctionsTable');
    const formatDate = (val) => {
        if (!val) return '—';
        const parsed = new Date(val);
        return isNaN(parsed) ? val : parsed.toLocaleDateString('ru-RU');
    };
    if (table) {
        table.innerHTML = corrections.map(item => {
            const payment = item.payment || {};
            const period = `${formatDate(item.period_start)}${item.period_end ? ' - ' + formatDate(item.period_end) : ''}`;
            const correctionDate = item.correction_date || payment.correction_date;
            return `<tr>
                <td>${item.operator_name || ''}</td>
                <td>${period}</td>
                <td>${(item.total_salary || 0).toLocaleString('ru-RU')} руб.</td>
                <td>${payment.total_salary ? payment.total_salary.toLocaleString('ru-RU') + ' руб.' : '—'}</td>
                <td>${formatDate(correctionDate)}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="openCorrection(${item.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCorrection(${item.id})">🗑️</button>
                </td>
            </tr>`;
        }).join('');
    }
}

async function deleteCorrection(correctionId) {
    if (!confirmDeletion('Удалить корректировку?')) return;
    await fetch(`/api/corrections/${correctionId}`, { method: 'DELETE' });
    loadCorrections();
    loadCalculations();
    loadPayments();
}

async function openCorrection(calcId) {
    const response = await fetch(`/api/calculations/${calcId}`);
    const calc = await response.json();
    if (!calc || !calc.id) return;
    document.getElementById('correctionCalcId').value = calc.id;
    const operatorSelect = document.getElementById('correctionOperator');
    if (operatorSelect) {
        operatorSelect.innerHTML = cachedOperators.map(op => `<option value='${op.id}'>${op.name}</option>`).join('');
        operatorSelect.value = calc.operator_id;
    }
    document.getElementById('correctionKcAmount').value = calc.kc_amount || 0;
    document.getElementById('correctionNonKcAmount').value = calc.non_kc_amount || 0;
    document.getElementById('correctionSalesAmount').value = calc.sales_amount || 0;
    document.getElementById('correctionKcPercent').value = calc.redemption_percent || 0;
    document.getElementById('correctionBonus').value = calc.additional_bonus || 0;
    document.getElementById('correctionPenalty').value = calc.penalty_amount || 0;
    document.getElementById('correctionComment').value = calc.comment || '';
    document.getElementById('correctionIncludeRedemption').checked = calc.include_redemption_percent !== 0;
    document.getElementById('correctionTotal').value = calc.total_salary || 0;
    deriveCorrectionAmounts();
    document.getElementById('correctionModal').style.display = 'block';
}

async function saveCorrection() {
    const calcId = document.getElementById('correctionCalcId').value;
    const payload = {
        operator_id: parseInt(document.getElementById('correctionOperator').value, 10),
        kc_amount: parseFloat(document.getElementById('correctionKcAmount').value) || 0,
        non_kc_amount: parseFloat(document.getElementById('correctionNonKcAmount').value) || 0,
        sales_amount: parseFloat(document.getElementById('correctionSalesAmount').value) || 0,
        redemption_percent: parseFloat(document.getElementById('correctionKcPercent').value) || 0,
        additional_bonus: parseFloat(document.getElementById('correctionBonus').value) || 0,
        penalty_amount: parseFloat(document.getElementById('correctionPenalty').value) || 0,
        comment: document.getElementById('correctionComment').value,
        include_redemption_percent: document.getElementById('correctionIncludeRedemption').checked
    };
    const response = await fetch(`/api/corrections/${calcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result && result.total_salary !== undefined) {
        document.getElementById('correctionTotal').value = result.total_salary;
    }
    loadCalculations();
    loadPayments();
    loadCorrections();
    closeModal('correctionModal');
}

function onOperatorChange() {
    const operatorId = document.getElementById('calcOperator').value;
    if (!operatorId) return;
    const operator = cachedOperators.find(o => `${o.id}` === `${operatorId}`);
    if (operator && operator.motivation_id) {
        document.getElementById('calcMotivationOverride').value = operator.motivation_id;
    }
}

async function editCalculation(calculationId) {
    const response = await fetch(`/api/calculations/${calculationId}`);
    const calc = await response.json();
    if (!calc || !calc.id) {
        alert('Расчет не найден');
        return;
    }

    document.getElementById('calcOperator').value = calc.operator_id;
    document.getElementById('calcMotivationOverride').value = calc.applied_motivation_id || '';
    document.getElementById('calcPeriodStart').value = calc.period_start || '';
    document.getElementById('calcPeriodEnd').value = calc.period_end || '';
    document.getElementById('workingDaysInPeriod').value = calc.working_days_in_period || 0;
    document.getElementById('kcAmount').value = calc.kc_amount || 0;
    document.getElementById('nonKcAmount').value = calc.non_kc_amount || 0;
    document.getElementById('salesAmount').value = calc.sales_amount || 0;
    document.getElementById('kcPercent').value = calc.redemption_percent || 0;
    document.getElementById('additionalBonus').value = calc.additional_bonus || calc.manual_fixed_bonus || 0;
    document.getElementById('bonusPercentSalary').value = calc.bonus_percent_salary || 0;
    document.getElementById('bonusPercentSales').value = calc.bonus_percent_sales || 0;
    document.getElementById('penaltyAmount').value = calc.penalty_amount || calc.manual_penalty || 0;
    document.getElementById('calcComment').value = calc.comment || '';
    const includeToggle = document.getElementById('includeRedemption');
    if (includeToggle) includeToggle.checked = calc.include_redemption_percent !== 0;

    deriveAmounts();
    setCalculationEditingState(calculationId);

    const summary = document.getElementById('calculationResult');
    if (summary) {
        summary.innerHTML = `<div class="alert alert-info">Редактирование расчета #${calculationId}. Внесите изменения и сохраните.</div>`;
    }
}

async function viewPaymentDetails(paymentId) {
    const response = await fetch(`/api/payments/${paymentId}`);
    const payment = await response.json();
    const details = `Оператор: ${payment.operator_name}\nПериод: ${payment.period_start || 'N/A'} - ${payment.period_end || 'N/A'}\nСумма продаж: ${payment.sales_amount || 0}\nПроцент выкупа: ${payment.kc_percent || 0}\nСумма выплаты: ${payment.total_salary || 0}\nСтатус: ${payment.is_paid ? 'Выплачено' : 'Ожидает'}`;
    alert(details);
}

async function editPayment(paymentId) {
    const response = await fetch(`/api/payments/${paymentId}`);
    const payment = await response.json();
    if (!payment || !payment.id) return;
    document.getElementById('paymentId').value = payment.id;
    const operatorSelect = document.getElementById('paymentOperator');
    if (operatorSelect) {
        operatorSelect.innerHTML = cachedOperators.map(op => `<option value='${op.id}'>${op.name}</option>`).join('');
        operatorSelect.value = payment.operator_id;
    }
    document.getElementById('paymentDate').value = payment.calculation_date || '';
    document.getElementById('paymentPeriodStart').value = payment.period_start || '';
    document.getElementById('paymentPeriodEnd').value = payment.period_end || '';
    document.getElementById('paymentSales').value = payment.sales_amount || 0;
    document.getElementById('paymentTotal').value = payment.total_salary || 0;
    document.getElementById('paymentIsPaid').checked = payment.is_paid === 1;
    document.getElementById('paymentModal').style.display = 'block';
}

async function savePaymentEdit() {
    const id = document.getElementById('paymentId').value;
    const payload = {
        operator_id: parseInt(document.getElementById('paymentOperator').value, 10),
        calculation_date: document.getElementById('paymentDate').value,
        period_start: document.getElementById('paymentPeriodStart').value,
        period_end: document.getElementById('paymentPeriodEnd').value,
        sales_amount: parseFloat(document.getElementById('paymentSales').value) || 0,
        total_salary: parseFloat(document.getElementById('paymentTotal').value) || 0,
        is_paid: document.getElementById('paymentIsPaid').checked,
    };
    await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    closeModal('paymentModal');
    loadPayments();
}

async function deletePayment(paymentId) {
    if (!confirmDeletion('Удалить выплату?')) return;
    await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
    loadPayments();
}

async function updatePaymentStatusById(paymentId, isPaid) {
    await updatePaymentStatus(paymentId, isPaid);
}

document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard');
    loadMotivations();
    loadOperators();
    loadCalculations();
    loadPayments();
    loadDashboard();
    enableModalInteractions('operatorModal');
    enableModalInteractions('motivationModal');
    enableModalInteractions('paymentModal');
    enableModalInteractions('correctionModal');
    setCalculationEditingState(null);
    ['kcAmount', 'nonKcAmount', 'salesAmount', 'kcPercent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', deriveAmounts);
    });
    ['correctionKcAmount', 'correctionNonKcAmount', 'correctionSalesAmount', 'correctionKcPercent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', deriveCorrectionAmounts);
    });
    ['dashboardMetric', 'dashboardOperator', 'dashboardPeriod', 'dashboardStart', 'dashboardEnd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', refreshDashboardChart);
    });
});
