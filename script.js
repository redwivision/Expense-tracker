function main() {
  const form = document.getElementById('transactionForm');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const transactionsList = document.getElementById('transactionsList');

  // Summary elements
  const sumIncomeEl = document.getElementById('sumIncome');
  const sumExpenseEl = document.getElementById('sumExpense');
  const sumBalanceEl = document.getElementById('sumBalance');
  const sumIncomeExcludedEl = document.getElementById('sumIncomeExcluded');
  const sumExpenseExcludedEl = document.getElementById('sumExpenseExcluded');
  const sumBalanceExcludedEl = document.getElementById('sumBalanceExcluded');

  // Charts
  const chartPieCtx = document.getElementById('chartPie');
  const chartLineCtx = document.getElementById('chartLine');
  let chartPie = null;
  let chartLine = null;

  // Filter controls
  const filterCategoryEl = document.getElementById('filterCategory');
  const filterYearEl = document.getElementById('filterYear');
  const filterMonthNumEl = document.getElementById('filterMonthNum');
  const clearFiltersBtn = document.getElementById('clearFilters');

  // Form options
  const excludeCheckbox = document.getElementById('excludeFromMain');

  /** State */
  const transactions = [];
  let editingId = null;

  const filters = {
    category: 'all', // category value or 'all'
    year: '', // YYYY or ''
    month: '' // MM or ''
  };

  /** Initialize default date to today */
  function setDefaultDateToToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  /** Storage */
  const STORAGE_KEY = 'expense-tracker:transactions';
  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions', e);
    }
  }
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Keep newest-first order as saved
        for (const txn of parsed) {
          transactions.push(normalizeTransaction(txn));
        }
      }
    } catch (e) {
      console.error('Failed to load transactions', e);
    }
  }

  /** Helpers */
  function formatCurrency(value, type) {
    const number = Number(value || 0);
    const formatted = number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (type === 'expense' ? '-' : '+') + '$' + formatted;
  }

  function formatPlainCurrency(value) {
    const number = Number(value || 0);
    return '$' + number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getSelectedType() {
    const checked = document.querySelector('input[name="type"]:checked');
    return checked ? checked.value : '';
  }

  function setSelectedType(value) {
    const input = document.querySelector(`input[name="type"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function getCategoryLabel(value) {
    const option = categorySelect.querySelector(`option[value="${value}"]`);
    return option ? option.textContent : value || 'Unknown';
  }

  function normalizeTransaction(txn) {
    return {
      id: txn.id,
      amount: Number(txn.amount),
      category: txn.category,
      categoryLabel: getCategoryLabel(txn.category),
      type: txn.type === 'income' ? 'income' : 'expense',
      date: txn.date,
      excludeFromMain: Boolean(txn.excludeFromMain)
    };
  }

  function extractYear(dateStr) {
    return (dateStr || '').slice(0, 4);
  }
  function extractMonth(dateStr) {
    return (dateStr || '').slice(5, 7);
  }

  function applyFilters(items) {
    return items.filter(txn => {
      const categoryOk = filters.category === 'all' || txn.category === filters.category;
      const yearOk = !filters.year || extractYear(txn.date) === filters.year;
      const monthOk = !filters.month || extractMonth(txn.date) === filters.month;
      // If both year and month provided, both must match (above checks ensure that)
      return categoryOk && yearOk && monthOk;
    });
  }

  function computeSummary(items) {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    const balance = income - expense;
    return { income, expense, balance };
  }

  // Chart datasets
  function buildPieData(items) {
    // Expenses only, grouped by category
    const totals = new Map();
    for (const t of items) {
      if (t.type !== 'expense') continue;
      const key = t.categoryLabel;
      totals.set(key, (totals.get(key) || 0) + t.amount);
    }
    const labels = Array.from(totals.keys());
    const data = Array.from(totals.values());
    const colors = labels.map((_, i) => `hsl(${(i * 47) % 360} 70% 50%)`);
    return { labels, data, colors };
  }

  function buildLineData(items) {
    // Group by YYYY-MM; produce sums for income and expense separately
    const buckets = new Map();
    for (const t of items) {
      const y = extractYear(t.date);
      const m = extractMonth(t.date);
      if (!y || !m) continue;
      const key = `${y}-${m}`;
      if (!buckets.has(key)) buckets.set(key, { income: 0, expense: 0 });
      const bucket = buckets.get(key);
      if (t.type === 'income') bucket.income += t.amount; else bucket.expense += t.amount;
    }
    const sortedKeys = Array.from(buckets.keys()).sort();
    const incomeData = sortedKeys.map(k => buckets.get(k).income);
    const expenseData = sortedKeys.map(k => buckets.get(k).expense);
    return { labels: sortedKeys, incomeData, expenseData };
  }

  function upsertCharts(filtered) {
    const considered = filtered.filter(t => !t.excludeFromMain); // main summary scope

    if (chartPieCtx) {
      const { labels, data, colors } = buildPieData(considered);
      if (!chartPie) {
        chartPie = new Chart(chartPieCtx, {
          type: 'pie',
          data: {
            labels,
            datasets: [{ data, backgroundColor: colors }]
          },
          options: { plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } } }
        });
      } else {
        chartPie.data.labels = labels;
        chartPie.data.datasets[0].data = data;
        chartPie.data.datasets[0].backgroundColor = colors;
        chartPie.update();
      }
    }

    if (chartLineCtx) {
      const { labels, incomeData, expenseData } = buildLineData(considered);
      if (!chartLine) {
        chartLine = new Chart(chartLineCtx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Income', data: incomeData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.2)', tension: 0.25 },
              { label: 'Expense', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', tension: 0.25 }
            ]
          },
          options: {
            scales: {
              x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.15)' } },
              y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.15)' } }
            },
            plugins: { legend: { labels: { color: '#cbd5e1' } } }
          }
        });
      } else {
        chartLine.data.labels = labels;
        chartLine.data.datasets[0].data = incomeData;
        chartLine.data.datasets[1].data = expenseData;
        chartLine.update();
      }
    }
  }

  function renderSummaries(filtered) {
    // Main summary = not excluded
    const mainItems = filtered.filter(t => !t.excludeFromMain);
    const exclItems = filtered.filter(t => t.excludeFromMain);

    if (sumIncomeEl && sumExpenseEl && sumBalanceEl) {
      const { income, expense, balance } = computeSummary(mainItems);
      sumIncomeEl.textContent = formatPlainCurrency(income);
      sumExpenseEl.textContent = formatPlainCurrency(expense);
      sumBalanceEl.textContent = formatPlainCurrency(balance);
    }

    if (sumIncomeExcludedEl && sumExpenseExcludedEl && sumBalanceExcludedEl) {
      const { income, expense, balance } = computeSummary(exclItems);
      sumIncomeExcludedEl.textContent = formatPlainCurrency(income);
      sumExpenseExcludedEl.textContent = formatPlainCurrency(expense);
      sumBalanceExcludedEl.textContent = formatPlainCurrency(balance);
    }
  }

  function populateFilterCategories() {
    if (!filterCategoryEl) return;
    // Start with 'all' + values from the main category select
    const existingValues = new Set();
    for (const opt of filterCategoryEl.querySelectorAll('option')) {
      existingValues.add(opt.value);
    }
    for (const opt of categorySelect.querySelectorAll('option')) {
      const value = opt.value;
      if (!value) continue; // skip placeholder
      if (!existingValues.has(value)) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = opt.textContent;
        filterCategoryEl.appendChild(o);
      }
    }
  }

  function populateFilterYears() {
    if (!filterYearEl) return;
    const seen = new Set();
    const years = [];
    for (const t of transactions) {
      const y = extractYear(t.date);
      if (y && !seen.has(y)) { seen.add(y); years.push(y); }
    }
    years.sort((a, b) => b.localeCompare(a)); // newest first

    // Preserve first option (All years)
    const current = filterYearEl.value;
    filterYearEl.innerHTML = '<option value="">All years</option>';
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      filterYearEl.appendChild(opt);
    }
    // Restore selection if still valid
    if (current && years.includes(current)) filterYearEl.value = current;
  }

  function createTransactionElement(txn) {
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.dataset.id = txn.id;

    const title = document.createElement('div');
    title.textContent = txn.categoryLabel;

    const meta = document.createElement('div');
    meta.className = 'transaction-meta';
    const typeBadge = document.createElement('span');
    typeBadge.className = 'badge';
    typeBadge.textContent = txn.type === 'income' ? 'Income' : 'Expense';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = new Date(txn.date).toLocaleDateString();
    meta.appendChild(typeBadge);
    meta.appendChild(dateSpan);
    if (txn.excludeFromMain) {
      const excl = document.createElement('span');
      excl.className = 'badge badge-excluded';
      excl.textContent = 'Excluded';
      meta.appendChild(excl);
    }

    const right = document.createElement('div');
    right.className = 'transaction-right';

    const amount = document.createElement('div');
    amount.className = 'transaction-amount ' + (txn.type === 'income' ? 'amount-income' : 'amount-expense');
    amount.textContent = formatCurrency(txn.amount, txn.type);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon btn-edit';
    editBtn.dataset.action = 'edit';
    editBtn.title = 'Edit';
    editBtn.textContent = 'Edit';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon btn-delete';
    delBtn.dataset.action = 'delete';
    delBtn.title = 'Delete';
    delBtn.textContent = 'Delete';

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    right.appendChild(amount);
    right.appendChild(actions);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(right);

    return item;
  }

  function renderTransactions() {
    const filtered = applyFilters(transactions);
    transactionsList.innerHTML = '';
    if (filtered.length === 0) {
      const p = document.createElement('p');
      p.className = 'no-transactions';
      p.textContent = 'No transactions yet. Add your first transaction above!';
      transactionsList.appendChild(p);
    } else {
      for (const txn of filtered) {
        transactionsList.appendChild(createTransactionElement(txn));
      }
    }
    renderSummaries(filtered);
    upsertCharts(filtered);
  }

  function validateForm() {
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const type = getSelectedType();
    const date = dateInput.value;

    let message = '';
    if (!Number.isFinite(amount) || amount < 0) message = 'Amount must be a non-negative number';
    else if (!category) message = 'Please select a category';
    else if (!type) message = 'Please choose income or expense';
    else if (!date) message = 'Please pick a date';

    return { valid: message === '', message };
  }

  function clearForm() {
    editingId = null;
    form.querySelector('.add-btn').textContent = 'Add Transaction';
    amountInput.value = '';
    categorySelect.value = '';
    const checked = document.querySelector('input[name="type"]:checked');
    if (checked) checked.checked = false;
    if (excludeCheckbox) excludeCheckbox.checked = false;
    setDefaultDateToToday();
  }

  function startEdit(txn) {
    editingId = txn.id;
    form.querySelector('.add-btn').textContent = 'Update Transaction';
    amountInput.value = String(txn.amount);
    categorySelect.value = txn.category;
    setSelectedType(txn.type);
    dateInput.value = txn.date;
    if (excludeCheckbox) excludeCheckbox.checked = Boolean(txn.excludeFromMain);
    amountInput.focus();
  }

  /** Events */
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const type = getSelectedType();
    const date = dateInput.value;
    const excludeFromMain = excludeCheckbox ? excludeCheckbox.checked : false;

    let message = '';
    if (!Number.isFinite(amount) || amount < 0) message = 'Amount must be a non-negative number';
    else if (!category) message = 'Please select a category';
    else if (!type) message = 'Please choose income or expense';
    else if (!date) message = 'Please pick a date';
    if (message) { alert(message); return; }

    if (editingId) {
      const idx = transactions.findIndex(t => t.id === editingId);
      if (idx !== -1) {
        const updated = normalizeTransaction({ id: editingId, amount, category, type, date, excludeFromMain });
        transactions[idx] = updated;
        saveTransactions();
        populateFilterYears();
        renderTransactions();
        clearForm();
      }
      return;
    }

    const txn = normalizeTransaction({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      amount,
      category,
      type,
      date,
      excludeFromMain
    });

    transactions.unshift(txn); // newest first
    saveTransactions();
    populateFilterYears();
    renderTransactions();
    clearForm();
  });

  // Filters events
  if (filterCategoryEl) {
    filterCategoryEl.addEventListener('change', function() {
      filters.category = filterCategoryEl.value || 'all';
      renderTransactions();
    });
  }
  if (filterYearEl) {
    filterYearEl.addEventListener('change', function() {
      filters.year = filterYearEl.value || '';
      renderTransactions();
    });
  }
  if (filterMonthNumEl) {
    filterMonthNumEl.addEventListener('change', function() {
      filters.month = filterMonthNumEl.value || '';
      renderTransactions();
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
      filters.category = 'all';
      filters.year = '';
      filters.month = '';
      if (filterCategoryEl) filterCategoryEl.value = 'all';
      if (filterYearEl) filterYearEl.value = '';
      if (filterMonthNumEl) filterMonthNumEl.value = '';
      renderTransactions();
    });
  }

  // Event delegation for actions
  transactionsList.addEventListener('click', function(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const action = target.dataset.action;
    if (!action) return;
    const item = target.closest('.transaction-item');
    if (!item) return;
    const id = item.dataset.id;
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    if (action === 'edit') {
      startEdit(txn);
    } else if (action === 'delete') {
      const confirmed = confirm('Delete this transaction?');
      if (!confirmed) return;
      const idx = transactions.findIndex(t => t.id === id);
      if (idx !== -1) {
        transactions.splice(idx, 1);
        saveTransactions();
        populateFilterYears();
        renderTransactions();
      }
      // If we were editing this one, reset the form state
      if (editingId === id) clearForm();
    }
  });

  // Init
  setDefaultDateToToday();
  loadTransactions();
  populateFilterCategories();
  populateFilterYears();
  renderTransactions();
}

// Run app
main();
