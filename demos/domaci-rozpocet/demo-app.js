// Demo: žádné ukládání. Všechno jen v paměti. Kategorie jsou napevno.
window.addEventListener('DOMContentLoaded', () => {
  const CATS = [
    { id:'home',    name:'Domácnost',    color:'#4f77ff' },
    { id:'transport', name:'Doprava',   color:'#ff7a59' },
    { id:'food',    name:'Jídlo',        color:'#ffcc3d' },
    { id:'housing', name:'Nájem / hypotéka', color:'#43d394' },
    { id:'clothes', name:'Nákupy/oblečení', color:'#a58bff' },
    { id:'subs',    name:'Předplatné',   color:'#52d1ff' },
    { id:'dine',    name:'Stravování venku', color:'#ff8cd1' },
    { id:'fun',     name:'Zábava',       color:'#8edb6b' }
  ];

  // In-memory stav
  const state = {
    month: '2025-10',
    tx: [
      {date:'2025-10-06', note:'Výplata', type:'income', category:'', amount: 34137},
      {date:'2025-10-07', note:'Nájem', type:'expense', category:'housing', amount:11500},
      {date:'2025-10-09', note:'Potraviny', type:'expense', category:'food', amount: 980},
      {date:'2025-10-12', note:'MHD kupon', type:'expense', category:'transport', amount: 365},
      {date:'2025-10-15', note:'Spotify', type:'expense', category:'subs', amount: 169},
      {date:'2025-10-16', note:'Restaurace', type:'expense', category:'dine', amount: 420},
    ],
  };

  // DOM refs
  const el = (id) => document.getElementById(id);
  const monthSelect = el('monthSelect');
  const addBtn = el('addBtn');
  const rows = el('rows');
  const incomes = el('incomes');
  const expenses = el('expenses');
  const balance = el('balance');
  const legend = el('categoryLegend'); // Změna id elementu legendy
  const chartCanvas = document.getElementById('expenseChart'); // Odkaz na canvas pro Chart.js
  let expenseChart; // Proměnná pro instanci grafu

  const dialog = document.getElementById('txDialog');
  const openDialog = () => {
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // Fallback bez native <dialog>
      dialog.setAttribute('open','');
      document.body.classList.add('backdrop-open');
    }
  };
  const closeDialog = () => {
    if (dialog && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      document.body.classList.remove('backdrop-open');
    }
  };

  // Cancel zavře dialog bez validace
  document.getElementById('txCancel').addEventListener('click', (e) => {
    e.preventDefault();
    closeDialog();
  });

  // ESC také zavře (nativně u <dialog>), ve fallbacku to sjednotíme
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog();
  });

  // init select kategorií
  const catSelect = el('txCategory');
  CATS.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    catSelect.appendChild(o);
  });

  // Přidání transakce
  addBtn.addEventListener('click', () => {
    // defaulty
    el('txDate').value = state.month + '-15';
    el('txNote').value = '';
    el('txType').value = 'expense';
    el('txCategory').value = CATS[0].id;
    el('txAmount').value = '';
    openDialog();   // ← místo d.showModal()
  });

  el('txForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = {
      date: el('txDate').value,
      note: el('txNote').value.trim(),
      type: el('txType').value,
      category: el('txType').value === 'income' ? '' : el('txCategory').value,
      amount: Math.max(0, Number(el('txAmount').value || 0))
    };
    // měsíční filtr – jen transakce v aktuálním měsíci
    if (!t.date.startsWith(state.month)) {
      alert('V demu jde přidávat jen do vybraného měsíce.');
      return;
    }
    state.tx.push(t);
    closeDialog();
    render();
  });

  monthSelect.addEventListener('change', () => {
    state.month = monthSelect.value;
    render();
  });

  function fmt(n){
    return n.toLocaleString('cs-CZ') + ' Kč';
  }

  function render(){
    // filtr měsíce
    const tx = state.tx.filter(t => t.date.startsWith(state.month));
    // součty
    const inc = tx.filter(t=>t.type==='income').reduce((a,b)=>a+b.amount,0);
    const exp = tx.filter(t=>t.type==='expense').reduce((a,b)=>a+b.amount,0);
    incomes.textContent = fmt(inc);
    expenses.textContent = fmt(exp);
    balance.textContent = fmt(inc-exp);

    // tabulka
    rows.innerHTML = tx.map(t => {
      const cat = t.type==='expense' ? (CATS.find(c=>c.id===t.category)?.name || '—') : '—';
      const typ = t.type==='income' ? 'Příjem' : 'Výdaj';
      const amount = (t.type==='income' ? '+' : '−') + t.amount.toLocaleString('cs-CZ') + ' Kč';
      return `<tr>
        <td>${t.date}</td><td>${escapeHTML(t.note||'')}</td>
        <td>${cat}</td><td>${typ}</td><td class="r">${amount}</td></tr>`;
    }).join('');

    // rozpad výdajů podle kategorií
    const byCat = new Map();
    for (const t of tx) if (t.type==='expense') {
      byCat.set(t.category, (byCat.get(t.category)||0) + t.amount);
    }
    const parts = CATS.map(c => ({...c, value: byCat.get(c.id)||0})).filter(p => p.value>0);
    drawChart(parts); // Změna volání na drawChart
    drawLegend(parts, exp);
  }

  function drawLegend(parts, total){
    if (!parts.length){ legend.innerHTML = '<p class="muted">Žádné výdaje v měsíci.</p>'; return; }
    legend.innerHTML = parts.map(p => {
      const share = total ? Math.round(p.value/total*100) : 0;
      return `
        <div class="legend-item">
            <div><span class="legend-color" style="background:${p.color}"></span> ${p.name}</div>
            <strong>${share}%</strong>
        </div>
      `;
    }).join('');
  }

  function drawChart(parts){
    if (expenseChart) {
      expenseChart.destroy(); // Zničení předchozí instance grafu
    }

    const data = {
      labels: parts.map(p => p.name),
      datasets: [{
        data: parts.map(p => p.value),
        backgroundColor: parts.map(p => p.color),
        borderWidth: 0, // Bez okrajů segmentů
      }]
    };

    expenseChart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: data,
      options: {
          responsive: true,
          maintainAspectRatio: false, // Důležité, aby poslouchal výšku divu
          cutout: '65%', // Udělá z koláče tenčí donut (v originálu je díra větší)
          plugins: {
              legend: {
                  display: false // Skryjeme výchozí legendu nahoře/dole, protože máme vlastní vpravo
              },
              tooltip: {
                  enabled: true
              }
          },
          layout: {
              padding: 0
          }
      }
    });
  }

  function escapeHTML(s){ return s.replace(/[&<>\"']/g, m => ({'&':'&','<':'<','>':'>','\"':'"',"\'":'&#39;'}[m])); }

  // start
  monthSelect.value = state.month;
  render();
});
