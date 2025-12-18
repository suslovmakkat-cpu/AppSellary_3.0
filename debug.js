// ПОЛНЫЙ ДИАГНОСТИЧЕСКИЙ МОДУЛЬ

// Базовые функции диагностики
function checkFunctionAvailability() {
    const functions = [
        'showSection', 'calculateSalary', 'addOperator', 'loadOperators',
        'loadCalculations', 'loadPayments', 'loadDashboard', 'updatePaymentStatus',
        'showOperatorModal', 'onOperatorChange', 'deriveAmounts',
        'closeModal', 'saveOperator', 'showSettingsTab', 'toggleSidebar',
        'showNotifications', 'toggleOperatorSettings'
    ];
    
    const available = {};
    functions.forEach(funcName => {
        available[funcName] = typeof window[funcName] === 'function';
    });
    
    return available;
}

function checkOperatorsData() {
    const operatorSelect = document.getElementById('operatorSelect');
    const calcOperator = document.getElementById('calcOperator');
    const operatorsTable = document.getElementById('operatorsTable');
    
    return {
        operatorSelect: {
            exists: !!operatorSelect,
            options: operatorSelect ? operatorSelect.options.length : 0,
            selected: operatorSelect ? operatorSelect.value : 'none'
        },
        calcOperator: {
            exists: !!calcOperator,
            options: calcOperator ? calcOperator.options.length : 0,
            selected: calcOperator ? calcOperator.value : 'none'
        },
        operatorsTable: {
            exists: !!operatorsTable,
            rows: operatorsTable ? operatorsTable.rows.length : 0,
            content: operatorsTable ? operatorsTable.innerHTML.substring(0, 200) : 'empty'
        }
    };
}

// Функция для проверки видимости элемента
function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
}

// Детальная проверка состояния приложения
function getDetailedAppStatus() {
    const status = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        
        // Активная секция
        activeSection: document.querySelector('.section:not([style*="display: none"])')?.id || 'unknown',
        
        // Все секции и их видимость
        sections: {},
        
        // Критические элементы интерфейса
        criticalElements: {},
        
        // Данные из API
        apiData: {},
        
        // Состояние форм
        forms: {},
        
        // Ошибки загрузки
        loadErrors: []
    };
    
    // Проверяем все секции
    document.querySelectorAll('.section').forEach(section => {
        status.sections[section.id] = {
            visible: section.style.display !== 'none',
            exists: true,
            childCount: section.children.length
        };
    });
    
    // Проверяем критические элементы
    const criticalElements = [
        'operatorsTable', 'calculationsTable', 'paymentsTable', 'dashboardCalculations',
        'operatorSelect', 'calcOperator', 'pageTitle', 'totalPaid', 'totalPending'
    ];
    
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        status.criticalElements[id] = {
            exists: !!element,
            content: element ? element.innerHTML.substring(0, 100) + '...' : 'MISSING',
            childCount: element ? element.children.length : 0
        };
    });
    
    // Проверяем формы
    const forms = ['operatorsTable', 'calculationsTable'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        status.forms[formId] = {
            exists: !!form,
            rowCount: form ? form.rows.length : 0
        };
    });
    
    return status;
}

// Функция для сбора визуальной информации о форме расчетов
function getCalculationFormStatus() {
    const form = {
        exists: false,
        fields: {},
        buttons: {},
        visibility: {}
    };
    
    // Основные поля формы расчетов
    const calculationFields = [
        'calcOperator', 'kcAmount', 'nonKcAmount', 'salesAmount', 
        'kcPercent', 'additionalBonus', 'penaltyAmount', 'calcComment',
        'calcPeriodStart', 'calcPeriodEnd', 'calcDate'
    ];
    
    calculationFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        form.fields[fieldId] = {
            exists: !!element,
            visible: element ? isElementVisible(element) : false,
            value: element ? element.value : null,
            placeholder: element ? element.placeholder : null,
            type: element ? element.type : null
        };
    });
    
    // Кнопки в форме расчетов
    const calculationButtons = [
        {id: 'calculateSalaryBtn', selector: '[onclick*="calculateSalary"]'}
    ];
    
    calculationButtons.forEach(button => {
        const element = button.id ? document.getElementById(button.id) : 
                         document.querySelector(button.selector);
        form.buttons[button.id || button.selector] = {
            exists: !!element,
            visible: element ? isElementVisible(element) : false,
            text: element ? element.textContent.trim() : null,
            disabled: element ? element.disabled : null
        };
    });
    
    return form;
}

// Функция для сбора информации о всех кнопках интерфейса
function getAllButtonsStatus() {
    const buttons = {
        navigation: [],
        forms: [],
        tables: [],
        modals: []
    };
    
    // Навигационные кнопки
    const navButtons = document.querySelectorAll('.nav-item, [onclick*="showSection"]');
    navButtons.forEach(button => {
        buttons.navigation.push({
            text: button.textContent.trim(),
            onclick: button.getAttribute('onclick'),
            visible: isElementVisible(button),
            active: button.classList.contains('active')
        });
    });
    
    // Кнопки в формах
    const formButtons = document.querySelectorAll('button, [type="submit"], [type="button"]');
    formButtons.forEach(button => {
        if (!button.closest('.nav-links')) {
            const category = button.closest('.modal') ? 'modals' : 
                           button.closest('form') ? 'forms' : 'tables';
            
            buttons[category].push({
                text: button.textContent.trim(),
                onclick: button.getAttribute('onclick'),
                visible: isElementVisible(button),
                disabled: button.disabled,
                id: button.id
            });
        }
    });
    
    return buttons;
}

// Функция для сбора информации о таблицах
function getTablesStatus() {
    const tables = {};
    
    const tableSelectors = {
        'operatorsTable': '#operatorsTable',
        'calculationsTable': '#calculationsTable', 
        'paymentsTable': '#paymentsTable',
        'dashboardCalculations': '#dashboardCalculations'
    };
    
    Object.entries(tableSelectors).forEach(([name, selector]) => {
        const table = document.querySelector(selector);
        tables[name] = {
            exists: !!table,
            visible: table ? isElementVisible(table) : false,
            rowCount: table ? table.rows.length : 0,
            headerCells: table && table.rows[0] ? 
                Array.from(table.rows[0].cells).map(cell => cell.textContent.trim()) : [],
            sampleData: table && table.rows.length > 1 ? 
                Array.from(table.rows[1].cells).map(cell => cell.textContent.trim()) : []
        };
    });
    
    return tables;
}

// Функция для сбора информации о текущем активном модуле
function getActiveModuleStatus() {
    const activeSection = document.querySelector('.section:not([style*="display: none"])');
    if (!activeSection) return null;
    
    return {
        id: activeSection.id,
        title: document.getElementById('pageTitle')?.textContent || 'Unknown',
        cards: Array.from(activeSection.querySelectorAll('.card')).map(card => ({
            title: card.querySelector('.card-header h3, .card-header h4')?.textContent?.trim() || 'No title',
            visible: isElementVisible(card),
            formGroups: Array.from(card.querySelectorAll('.form-group')).map(group => ({
                label: group.querySelector('label')?.textContent?.trim() || 'No label',
                inputs: Array.from(group.querySelectorAll('input, select, textarea')).map(input => ({
                    id: input.id,
                    type: input.type,
                    value: input.value,
                    placeholder: input.placeholder,
                    visible: isElementVisible(input)
                }))
            }))
        }))
    };
}

// Расширенная диагностика с визуальной информацией
async function showVisualDiagnostics() {
    console.log('🎨 ВИЗУАЛЬНАЯ ДИАГНОСТИКА ИНТЕРФЕЙСА:');
    console.log('====================================');
    
    const functions = checkFunctionAvailability();
    const operators = checkOperatorsData();
    const calculationForm = getCalculationFormStatus();
    const allButtons = getAllButtonsStatus();
    const tables = getTablesStatus();
    const activeModule = getActiveModuleStatus();
    const errors = JSON.parse(localStorage.getItem('js_errors') || '[]');
    
    console.log('📊 АКТИВНЫЙ МОДУЛЬ:');
    if (activeModule) {
        console.log('- ID:', activeModule.id);
        console.log('- Заголовок:', activeModule.title);
        console.log('- Карточки:', activeModule.cards.length);
        activeModule.cards.forEach((card, index) => {
            console.log(`  Карточка ${index + 1}: "${card.title}"`);
            card.formGroups.forEach(group => {
                console.log(`    - ${group.label}:`);
                group.inputs.forEach(input => {
                    console.log(`      ↳ ${input.id} (${input.type}): "${input.value}" ${input.visible ? '✅' : '❌'}`);
                });
            });
        });
    }
    
    console.log('📝 ФОРМА РАСЧЕТОВ ЗП:');
    Object.entries(calculationForm.fields).forEach(([field, data]) => {
        console.log(`- ${field}: ${data.exists ? '✅' : '❌'} ${data.visible ? 'видим' : 'скрыт'} = "${data.value}"`);
    });
    
    console.log('🔘 ВСЕ КНОПКИ ИНТЕРФЕЙСА:');
    Object.entries(allButtons).forEach(([category, buttons]) => {
        console.log(`${category.toUpperCase()}:`);
        buttons.forEach(button => {
            console.log(`- "${button.text}" ${button.visible ? '✅' : '❌'} ${button.disabled ? '(disabled)' : ''}`);
            if (button.onclick) {
                console.log(`  ↳ ${button.onclick}`);
            }
        });
    });
    
    console.log('📊 ТАБЛИЦЫ:');
    Object.entries(tables).forEach(([name, table]) => {
        console.log(`- ${name}: ${table.exists ? '✅' : '❌'} ${table.visible ? 'видима' : 'скрыта'} (${table.rowCount} строк)`);
        if (table.headerCells.length > 0) {
            console.log(`  Заголовки: ${table.headerCells.join(' | ')}`);
        }
        if (table.sampleData.length > 0) {
            console.log(`  Пример данных: ${table.sampleData.join(' | ')}`);
        }
    });
    
    console.log('⚙️ ФУНКЦИИ:');
    Object.entries(functions).forEach(([func, available]) => {
        console.log(`- ${func}: ${available ? '✅' : '❌'} ${available ? 'доступна' : 'ОТСУТСТВУЕТ'}`);
    });
    
    console.log('👥 ОПЕРАТОРЫ:');
    console.log('- Select для расчетов:', operators.calcOperator);
    console.log('- Таблица операторов:', operators.operatorsTable);
    
    console.log('🚨 ОШИБКИ:', errors.length);
    errors.forEach((error, index) => {
        console.log(`Ошибка ${index + 1}:`, error.message, `в ${error.file}:${error.line}`);
    });
    
    return {
        activeModule,
        calculationForm,
        allButtons,
        tables,
        functions,
        operators,
        errors
    };
}

// Функция для копирования визуальных логов
async function copyVisualLogs() {
    try {
        const diagnostics = await showVisualDiagnostics();
        const logText = JSON.stringify(diagnostics, null, 2);
        
        // Создаем временный элемент для копирования
        const textArea = document.createElement('textarea');
        textArea.value = logText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        console.log('✅ Визуальные логи скопированы в буфер обмена!');
        alert('Визуальные логи скопированы в буфер обмена!');
        
        return diagnostics;
    } catch (error) {
        console.error('Ошибка копирования:', error);
        alert('Ошибка при копировании логов: ' + error.message);
    }
}

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('🚨 ГЛОБАЛЬНАЯ ОШИБКА:', e.error);
    console.error('Файл:', e.filename);
    console.error('Строка:', e.lineno, 'Колонка:', e.colno);
    console.error('Stack:', e.error?.stack);
    
    // Сохраняем в localStorage для последующего анализа
    const errors = JSON.parse(localStorage.getItem('js_errors') || '[]');
    errors.push({
        message: e.error?.message || e.message,
        file: e.filename,
        line: e.lineno,
        column: e.colno,
        stack: e.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href
    });
    localStorage.setItem('js_errors', JSON.stringify(errors));
});

// Добавляем глобальные функции для отладки
window.appDebug = {
    getStatus: getDetailedAppStatus,
    getLogs: copyVisualLogs,
    showDiagnostics: showVisualDiagnostics,
    copyLogs: copyVisualLogs,
    checkFunctions: checkFunctionAvailability,
    checkOperators: checkOperatorsData,
    checkButtons: getAllButtonsStatus,
    checkForm: getCalculationFormStatus,
    checkTables: getTablesStatus,
    visualDiagnostics: showVisualDiagnostics
};

console.log('✅ ДИАГНОСТИЧЕСКИЕ ФУНКЦИИ ЗАГРУЖЕНЫ');
console.log('Используйте:');
console.log('- appDebug.copyLogs() - скопировать визуальные логи');
console.log('- appDebug.visualDiagnostics() - показать диагностику');
console.log('- appDebug.checkForm() - проверить форму расчетов');
