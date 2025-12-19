let cachedOperators = [];
let cachedMotivations = [];
const modalStates = {};

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
            settings: 'Настройки'
        };
        pageTitle.textContent = titles[sectionName] || 'Дашборд';
    }
}

function formatSalaryType(type) {
    if (type === 'fixed') return 'Фиксированная';
    if (type === 'progressive') return 'Прогрессивная';
    return 'Не выбрано';
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
    document.getElementById('operatorSalaryType').value = '';
    document.getElementById('operatorBasePercent').value = '0';
    document.getElementById('operatorTaxBonus').value = '0';
    document.getElementById('operatorStatus').value = '1';
    document.getElementById('operatorMotivation').value = '';
    applyModalState('operatorModal', document.querySelector('#operatorModal .modal-content'));
    document.getElementById('operatorModal').style.display = 'block';
    toggleOperatorSettings();
}

function toggleOperatorSettings() {
    const salaryType = document.getElementById('operatorSalaryType').value;
    const basePercentField = document.getElementById('operatorBasePercent');
    const taxBonusField = document.getElementById('operatorTaxBonus');
    const disableCustom = !salaryType;
    basePercentField.required = salaryType === 'fixed';
    basePercentField.disabled = disableCustom;
    taxBonusField.disabled = disableCustom;

    const helper = document.getElementById('operatorSalaryHint');
    if (helper) {
        if (disableCustom || parseFloat(basePercentField.value || '0') === 0 || parseFloat(taxBonusField.value || '0') === 0) {
            helper.style.display = 'block';
        } else {
            helper.style.display = 'none';
        }
    }
}

async function saveOperator() {
    const operatorId = document.getElementById('operatorId').value;
    const payload = {
        name: document.getElementById('operatorName').value,
        salary_type: document.getElementById('operatorSalaryType').value,
        base_percent: parseFloat(document.getElementById('operatorBasePercent').value) || 0,
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
    document.getElementById('operatorSalaryType').value = operator.salary_type || '';
    document.getElementById('operatorBasePercent').value = operator.base_percent || 0;
    document.getElementById('operatorTaxBonus').value = operator.tax_bonus || 0;
    document.getElementById('operatorStatus').value = operator.is_active;
    document.getElementById('operatorMotivation').value = operator.motivation_id || '';
    applyModalState('operatorModal', document.querySelector('#operatorModal .modal-content'));
    document.getElementById('operatorModal').style.display = 'block';
    toggleOperatorSettings();
}

function deriveAmounts() {
    const kcField = document.getElementById('kcAmount');
    const nonKcField = document.getElementById('nonKcAmount');
    const salesField = document.getElementById('salesAmount');
    const percentField = document.getElementById('kcPercent');

    const kcAmount = parseFloat(kcField.value);
    const nonKcAmount = parseFloat(nonKcField.value);
    const salesAmount = parseFloat(salesField.value);
    const redemptionPercent = parseFloat(percentField.value);

    const values = {
        kc: isNaN(kcAmount) ? null : kcAmount,
        nonKc: isNaN(nonKcAmount) ? null : nonKcAmount,
        sales: isNaN(salesAmount) ? null : salesAmount,
        percent: isNaN(redemptionPercent) ? null : redemptionPercent
    };

    let kcVal = values.kc;
    let nonKcVal = values.nonKc;
    let salesVal = values.sales;
    let percentVal = values.percent;

    const provided = [values.kc, values.nonKc, values.sales, values.percent].filter(v => v !== null).length;

    if (provided >= 2) {
        if (values.kc !== null && values.sales !== null) {
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (values.kc !== null && values.nonKc !== null) {
            salesVal = kcVal + nonKcVal;
        } else if (values.sales !== null && values.nonKc !== null) {
            kcVal = Math.max(salesVal - nonKcVal, 0);
        } else if (values.sales !== null && values.percent !== null) {
            kcVal = salesVal * percentVal / 100;
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (values.kc !== null && values.percent !== null && percentVal !== 0) {
            salesVal = kcVal * 100 / percentVal;
            nonKcVal = Math.max(salesVal - kcVal, 0);
        } else if (values.nonKc !== null && values.percent !== null && percentVal < 100) {
            salesVal = nonKcVal * 100 / (100 - percentVal);
            kcVal = Math.max(salesVal - nonKcVal, 0);
        }
    } else if (provided === 1) {
        if (values.sales !== null) {
            kcVal = salesVal;
            nonKcVal = 0;
        } else if (values.kc !== null) {
            salesVal = kcVal;
            nonKcVal = 0;
        } else if (values.nonKc !== null) {
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

    if (values.kc === null) kcField.value = kcVal;
    if (values.nonKc === null) nonKcField.value = nonKcVal;
    if (values.sales === null) salesField.value = salesVal;
    if (percentField) percentField.value = percentVal.toFixed(1);
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
        bonus_percent_sales: parseFloat(document.getElementById('bonusPercentSales').value) || 0
    };
    const response = await fetch('/api/calculate', {
        method: 'POST',
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
        const planLine = result.plan_target && result.plan_target > 0 ? `<br>Выполнение плана: ${(result.plan_completion * 100).toFixed(1)}%` : '';
        const taxLine = result.motivation_tax_bonus ? `<br>Налоговый бонус: ${result.motivation_tax_bonus.toLocaleString('ru-RU')} руб.` : '';
        summary.innerHTML = `
            <div class="alert alert-success">
                Итоговая ЗП: <strong>${result.total_salary.toLocaleString('ru-RU')} руб.</strong><br>
                Процент выкупа: ${result.redemption_percent.toFixed(1)}%<br>
                Используемая мотивация: ${result.applied_motivation || 'по умолчанию'}${planLine}${taxLine}
            </div>`;
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
        operatorsTable.innerHTML = cachedOperators.map(op => `
            <tr>
                <td>${op.name}</td>
                <td>${formatSalaryType(op.salary_type)}</td>
                <td>${op.base_percent ? `${op.base_percent}%` : '—'}</td>
                <td>${op.tax_bonus ? `${op.tax_bonus}%` : '—'}</td>
                <td>${op.is_active ? '✅ Активен' : '❌ Неактивен'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editOperator(${op.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="trashOperator(${op.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    }
    if (calcOperator) {
        calcOperator.innerHTML = `<option value=''>Выберите оператора</option>` +
            cachedOperators.map(op => `<option value='${op.id}'>${op.name}</option>`).join('');
    }
    if (operatorMotivation && cachedMotivations) {
        operatorMotivation.innerHTML = `<option value=''>Не выбрано</option>` +
            cachedMotivations.filter(m => m.is_deleted === 0 && m.is_active === 1).map(m => `<option value='${m.id}'>${m.name}</option>`).join('');
    }
}

async function trashOperator(operatorId) {
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
            return `<tr>
                <td>${payment.operator_name || '—'}</td>
                <td>${payment.period_start || '—'}</td>
                <td>${payment.sales_amount ? payment.sales_amount.toLocaleString('ru-RU') + ' руб.' : '—'}</td>
                <td>${payment.kc_percent ? payment.kc_percent.toFixed(1) + '%' : '—'}</td>
                <td>${payment.total_salary ? payment.total_salary.toLocaleString('ru-RU') + ' руб.' : '0 руб.'}</td>
                <td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${payment.is_paid ? 'checked' : ''} onchange="updatePaymentStatus(${payment.id}, this.checked)"> <small>${payment.is_paid ? 'Выплачено' : 'Ожидает'}</small></div></td>
                <td>${paidDate}</td>
                <td><button class="btn btn-sm btn-info" onclick="viewPaymentDetails(${payment.id})">👁️</button></td>
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
                <small>${formatSalaryType(op.salary_type)}</small>
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
            const taxBonus = parseFloat(cfg.tax_bonus_percent || 0);
            return taxBonus ? `${summary}. Налоговый бонус: ${taxBonus}%` : summary;
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
    document.getElementById('motivationType').value = motivation ? motivation.motivation_type : 'composite';
    document.getElementById('motivationStatus').value = motivation && motivation.is_active === 0 ? '0' : '1';
    document.getElementById('motivationDescription').value = motivation ? (motivation.description || '') : '';
    document.getElementById('motivationTaxBonus').value = 0;
    applyModalState('motivationModal', document.querySelector('#motivationModal .modal-content'));

    const blocksContainer = document.getElementById('motivationBlocks');
    blocksContainer.innerHTML = '';
    if (motivation) {
        try {
            const cfg = JSON.parse(motivation.config_json || '{}');
            document.getElementById('motivationTaxBonus').value = cfg.tax_bonus_percent || 0;
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
    const type = document.getElementById('motivationType').value;
    const blocks = collectBlocks();
    const taxBonus = parseFloat(document.getElementById('motivationTaxBonus').value) || 0;
    const config = JSON.stringify({ blocks, tax_bonus_percent: taxBonus });
    const payload = {
        name: document.getElementById('motivationName').value,
        motivation_type: type,
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
    await fetch(`/api/trash/motivation/${motivationId}`, { method: 'POST' });
    loadMotivations();
}

async function trashCalculation(calculationId) {
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
async function deleteOperatorForever(id) { await fetch(`/api/trash/operator/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deletePaymentForever(id) { await fetch(`/api/trash/payment/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deleteCalculationForever(id) { await fetch(`/api/trash/calculation/${id}/delete`, { method: 'DELETE' }); loadTrash(); }
async function deleteMotivationForever(id) { await fetch(`/api/trash/motivation/${id}/delete`, { method: 'DELETE' }); loadTrash(); }

function onOperatorChange() {
    const operatorId = document.getElementById('calcOperator').value;
    if (!operatorId) return;
    const operator = cachedOperators.find(o => `${o.id}` === `${operatorId}`);
    if (operator && operator.motivation_id) {
        document.getElementById('calcMotivationOverride').value = operator.motivation_id;
    }
}

function editCalculation(calculationId) {
    alert(`Редактирование расчета #${calculationId} готовится`);
}

async function viewPaymentDetails(paymentId) {
    const response = await fetch(`/api/payments/${paymentId}`);
    const payment = await response.json();
    const details = `Оператор: ${payment.operator_name}\nПериод: ${payment.period_start || 'N/A'} - ${payment.period_end || 'N/A'}\nСумма продаж: ${payment.sales_amount || 0}\nПроцент выкупа: ${payment.kc_percent || 0}\nСумма выплаты: ${payment.total_salary || 0}\nСтатус: ${payment.is_paid ? 'Выплачено' : 'Ожидает'}`;
    alert(details);
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
    ['kcAmount', 'nonKcAmount', 'salesAmount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', deriveAmounts);
    });
});
