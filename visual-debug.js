// СИСТЕМА ВИЗУАЛЬНОЙ ДИАГНОСТИКИ ИНТЕРФЕЙСА

// Функция для создания текстового "скриншота" видимого интерфейса
function createInterfaceScreenshot() {
    const screenshot = {
        timestamp: new Date().toLocaleString('ru-RU'),
        activeModule: document.querySelector('.section:not([style*="display: none"])')?.id || 'unknown',
        moduleTitle: document.getElementById('pageTitle')?.textContent || 'Unknown',
        visibleElements: []
    };

    // Собираем все видимые элементы с их текстом
    const visibleSelectors = [
        '.card-header h3', '.card-header h4', 
        'label', 'button', 'th', 'td',
        '.form-control', '.nav-item'
    ];

    visibleSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (isElementVisible(element)) {
                const text = element.textContent?.trim() || element.value || element.placeholder;
                if (text && text.length > 0) {
                    screenshot.visibleElements.push({
                        type: selector,
                        text: text.substring(0, 100),
                        visible: true
                    });
                }
            }
        });
    });

    return screenshot;
}

// Функция для детального анализа каждого модуля
function analyzeModuleProblems() {
    const problems = [];
    const activeSection = document.querySelector('.section:not([style*="display: none"])');
    
    if (!activeSection) {
        problems.push('❌ Нет активной секции');
        return problems;
    }

    const moduleId = activeSection.id;
    problems.push(`🔍 Анализ модуля: ${moduleId}`);

    // Анализ дашборда
    if (moduleId === 'dashboard') {
        const elementsToCheck = [
            { id: 'dashboardStats', name: 'Статистика дашборда' },
            { id: 'activeOperators', name: 'Активные операторы' },
            { id: 'recentPayments', name: 'Последние выплаты' },
            { id: 'totalPaid', name: 'Всего выплачено' },
            { id: 'totalPending', name: 'Ожидает выплаты' }
        ];

        elementsToCheck.forEach(item => {
            const element = document.getElementById(item.id);
            if (!element) {
                problems.push(`❌ ${item.name}: элемент отсутствует`);
            } else {
                const content = element.textContent || element.innerHTML;
                if (content.includes('Загрузка') || content.trim().length < 10) {
                    problems.push(`❌ ${item.name}: показывает "Загрузка" или пусто`);
                } else {
                    problems.push(`✅ ${item.name}: данные загружены`);
                }
            }
        });
    }

    // Анализ операторов
    if (moduleId === 'operators') {
        const table = document.getElementById('operatorsTable');
        if (!table) {
            problems.push('❌ Таблица операторов отсутствует');
        } else {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            problems.push(`📊 Заголовки таблицы: ${headers.join(', ')}`);
            
            const rows = table.querySelectorAll('tr');
            if (rows.length <= 1) {
                problems.push('❌ В таблице нет данных операторов');
            } else {
                problems.push(`✅ Операторов: ${rows.length - 1} строк`);
                
                // Проверяем содержание первой строки
                const firstRow = rows[1];
                const cells = Array.from(firstRow.querySelectorAll('td')).map(td => td.textContent.trim());
                problems.push(`📝 Пример данных: ${cells.join(' | ')}`);
            }
        }

        // Проверяем кнопки
        const buttons = document.querySelectorAll('#operators button');
        problems.push(`🔘 Кнопок в модуле: ${buttons.length}`);
        buttons.forEach(btn => {
            problems.push(`   - "${btn.textContent.trim()}" ${isElementVisible(btn) ? '✅' : '❌'}`);
        });
    }

    // Анализ расчетов
    if (moduleId === 'calculations') {
        // Проверяем форму
        const formInputs = ['calcOperator', 'kcAmount', 'nonKcAmount', 'salesAmount', 'kcPercent'];
        formInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                problems.push(`📝 ${id}: ${element.value || 'пусто'} ${isElementVisible(element) ? '✅' : '❌'}`);
            }
        });

        // Проверяем таблицу расчетов
        const table = document.getElementById('calculationsTable');
        if (table) {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            problems.push(`📊 Заголовки расчетов: ${headers.join(', ')}`);
            
            const missingHeaders = [];
            if (!headers.includes('ЗП')) missingHeaders.push('ЗП');
            if (!headers.includes('Дата')) missingHeaders.push('Дата');
            if (!headers.includes('Действия')) missingHeaders.push('Действия');
            
            if (missingHeaders.length > 0) {
                problems.push(`❌ Отсутствуют колонки: ${missingHeaders.join(', ')}`);
            }
        }
    }

    // Анализ выплат
    if (moduleId === 'payments') {
        const table = document.getElementById('paymentsTable');
        if (table) {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            problems.push(`📊 Заголовки выплат: ${headers.join(', ')}`);
            
            const rows = table.querySelectorAll('tr');
            if (rows.length > 1) {
                const firstRow = rows[1];
                const cells = Array.from(firstRow.querySelectorAll('td'));
                problems.push(`📝 Пример строки: ${cells.length} ячеек`);
                
                cells.forEach((cell, index) => {
                    const content = cell.textContent.trim();
                    const isEmpty = !content || content === '' || content === '​';
                    problems.push(`   ${headers[index] || 'Ячейка ' + index}: ${isEmpty ? '❌ ПУСТО' : '✅ ' + content}`);
                });
            }
        }
    }

    return problems;
}

// Функция для проверки видимости элемента
function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
}

// Основная функция диагностики
function showWhatUserSees() {
    console.log('👁️ ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ:');
    console.log('=========================');
    
    const screenshot = createInterfaceScreenshot();
    const problems = analyzeModuleProblems();
    
    console.log('🕒 Время:', screenshot.timestamp);
    console.log('📱 Активный модуль:', screenshot.moduleTitle);
    console.log('');
    
    console.log('🔍 ПРОБЛЕМЫ ИНТЕРФЕЙСА:');
    problems.forEach(problem => {
        console.log(problem);
    });
    
    console.log('');
    console.log('📋 ВИДИМЫЕ ЭЛЕМЕНТЫ:');
    screenshot.visibleElements.forEach((elem, index) => {
        if (index < 20) { // Ограничиваем вывод
            console.log(`- [${elem.type}] ${elem.text}`);
        }
    });
    
    return {
        screenshot,
        problems
    };
}

// Функция для копирования визуального отчета
async function copyVisualReport() {
    try {
        const report = showWhatUserSees();
        const reportText = JSON.stringify(report, null, 2);
        
        const textArea = document.createElement('textarea');
        textArea.value = reportText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        console.log('✅ Визуальный отчет скопирован в буфер обмена!');
        alert('Визуальный отчет скопирован! Отправьте его мне.');
        
        return report;
    } catch (error) {
        console.error('Ошибка копирования:', error);
    }
}

// Добавляем глобальные функции
window.visualDebug = {
    seeWhatUserSees: showWhatUserSees,
    copyReport: copyVisualReport,
    analyzeProblems: analyzeModuleProblems
};

console.log('✅ СИСТЕМА ВИЗУАЛЬНОЙ ДИАГНОСТИКИ ЗАГРУЖЕНА');
console.log('Используйте:');
console.log('- visualDebug.seeWhatUserSees() - увидеть что видит пользователь');
console.log('- visualDebug.copyReport() - скопировать визуальный отчет');
