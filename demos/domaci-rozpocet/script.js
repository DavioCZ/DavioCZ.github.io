// --- DEMO DATA ---
// Toto simuluje databázi
const transactions = [
    { id: 1, date: '2025-10-06', desc: 'Výplata', category: 'Příjem', amount: 34137, type: 'income' },
    { id: 2, date: '2025-10-07', desc: 'Nájem bytu', category: 'Bydlení', amount: -11500, type: 'expense' },
    { id: 3, date: '2025-10-09', desc: 'Nákup Lidl', category: 'Jídlo', amount: -1280, type: 'expense' },
    { id: 4, date: '2025-10-10', desc: 'Netflix', category: 'Zábava', amount: -199, type: 'expense' },
    { id: 5, date: '2025-10-12', desc: 'Benzina', category: 'Doprava', amount: -1500, type: 'expense' },
    { id: 6, date: '2025-10-15', desc: 'Oběd s kolegy', category: 'Restaurace', amount: -245, type: 'expense' },
    { id: 7, date: '2025-10-18', desc: 'Lékárna', category: 'Zdraví', amount: -350, type: 'expense' },
];

// --- KONFIGURACE BAREV ---
const categoryColors = {
    'Bydlení': '#10b981', // Zelená
    'Jídlo': '#f59e0b',   // Oranžová
    'Doprava': '#3b82f6', // Modrá
    'Zábava': '#8b5cf6',  // Fialová
    'Restaurace': '#ef4444', // Červená
    'Zdraví': '#ec4899',  // Růžová
    'Ostatní': '#6b7280'  // Šedá
};

// --- HLAVNÍ FUNKCE ---
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});

function renderDashboard() {
    // 1. Spočítat součty
    let income = 0;
    let expense = 0;
    const expenseByCategory = {};

    transactions.forEach(t => {
        if (t.type === 'income') {
            income += t.amount;
        } else {
            expense += Math.abs(t.amount);
            // Agregace pro graf
            if (!expenseByCategory[t.category]) expenseByCategory[t.category] = 0;
            expenseByCategory[t.category] += Math.abs(t.amount);
        }
    });

    const balance = income - expense;

    // 2. Vypsat čísla do karet
    document.getElementById('totalIncome').innerText = formatCurrency(income);
    document.getElementById('totalExpense').innerText = formatCurrency(expense);
    
    const balanceEl = document.getElementById('totalBalance');
    balanceEl.innerText = formatCurrency(balance);
    balanceEl.className = `mb-0 fw-bold ${balance >= 0 ? 'text-success' : 'text-danger'}`;
    
    document.getElementById('balanceMsg').innerText = balance >= 0 ? "Jste v plusu, skvělé!" : "Pozor, jste v mínusu.";
    document.getElementById('chartTotal').innerText = formatCurrency(expense);

    // 3. Vykreslit tabulku
    renderTable();

    // 4. Vykreslit graf
    renderChart(expenseByCategory);
}

function renderTable() {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';

    // Seřadit podle data (nejnovější nahoře)
    const sortedData = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedData.forEach(t => {
        const tr = document.createElement('tr');
        const amountClass = t.type === 'income' ? 'text-success' : 'text-danger';
        const sign = t.type === 'income' ? '+' : '-';
        
        tr.innerHTML = `
            <td class="ps-4 text-muted">${formatDate(t.date)}</td>
            <td class="fw-medium">${t.desc}</td>
            <td><span class="badge bg-light text-dark border">${t.category}</span></td>
            <td class="text-end pe-4 fw-bold ${amountClass}">${sign} ${formatCurrency(Math.abs(t.amount), false)}</td>
        `;
        tbody.appendChild(tr);
    });
}

let myChart = null;

function renderChart(dataObj) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // Příprava dat pro Chart.js
    const labels = Object.keys(dataObj);
    const dataValues = Object.values(dataObj);
    const bgColors = labels.map(cat => categoryColors[cat] || '#9ca3af');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Tloušťka prstence
            plugins: {
                legend: { display: false }, // Vypneme defaultní legendu
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' ' + context.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            }
        }
    });

    generateCustomLegend(labels, dataValues, bgColors);
}

function generateCustomLegend(labels, values, colors) {
    const container = document.getElementById('categoryLegend');
    container.innerHTML = '';
    
    const total = values.reduce((a, b) => a + b, 0);

    labels.forEach((label, index) => {
        const value = values[index];
        const percent = Math.round((value / total) * 100);
        const color = colors[index];

        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="legend-indicator" style="background-color: ${color}"></span>
                <span class="text-muted">${label}</span>
            </div>
            <div class="fw-semibold">
                ${percent}% <span class="text-muted small ms-2 fw-normal">(${formatCurrency(value, false)})</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- POMOCNÉ FUNKCE ---

function formatCurrency(amount, withSymbol = true) {
    const formatted = new Intl.NumberFormat('cs-CZ').format(amount);
    return withSymbol ? `${formatted} Kč` : formatted;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ');
}

// Demo funkce pro tlačítko "+ Transakce"
function addRandomTransaction() {
    const items = [
        { d: 'Káva s sebou', c: 'Jídlo', a: -75 },
        { d: 'Lístek na vlak', c: 'Doprava', a: -250 },
        { d: 'Kino', c: 'Zábava', a: -300 },
        { d: 'Nákup večeře', c: 'Jídlo', a: -450 }
    ];
    const randomItem = items[Math.floor(Math.random() * items.length)];
    
    const newTrans = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0], // Dnešní datum
        desc: randomItem.d,
        category: randomItem.c,
        amount: randomItem.a,
        type: 'expense'
    };

    transactions.unshift(newTrans); // Přidat na začátek
    renderDashboard(); // Překreslit vše
}
