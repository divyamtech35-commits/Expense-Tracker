import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CircleHelp, Download, Ellipsis, HandCoins, LayoutDashboard, Plus, ReceiptText, Search, Settings2, Sparkles, Tag, Trash2, Wallet, Users, X } from 'lucide-react';
import FriendsWorkspace from './FriendsWorkspace.jsx';
import './friends.css';

const money = (value, compact = false, currency) => {
  if (!currency) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard' }).format(value); }
  catch { return '—'; }
};
const currencySymbol = (currency) => {
  if (!currency) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).formatToParts(0).find((part) => part.type === 'currency')?.value || currency; }
  catch { return currency; }
};
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const categoryPalette = ['#d3e96b', '#a894f4', '#f5ae75', '#71c7ae', '#ee8799', '#71a3f0'];
const colorForCategory = (name = '') => categoryPalette[[...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % categoryPalette.length];

function App() {
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState('');
  const [savingTransaction, setSavingTransaction] = useState(false);
  const transactionSubmission = useRef(false);
  const settingsMutationQueue = useRef(Promise.resolve());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('All transactions');
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [form, setForm] = useState({ type: 'expense', amount: '', category: '', note: '', date: localDateString(), paymentMethod: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [categorySettingType, setCategorySettingType] = useState('expense');
  const [dailyBudgetDraft, setDailyBudgetDraft] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState('');
  const [activePage, setActivePage] = useState('overview');

  function openSettings() {
    if (!settings) { setToast(settingsError || 'Settings are still loading from the database.'); return; }
    setSettingsOpen(true);
  }

  useEffect(() => {
    let cancelled = false;
    setTransactionsLoading(true);
    fetch(`/api/transactions?month=${monthKey(month)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not load transactions.');
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        setTransactions(result.transactions || []);
        setTransactionsError('');
      })
      .catch((error) => { if (!cancelled) setTransactionsError(error.message); })
      .finally(() => { if (!cancelled) setTransactionsLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not load settings.');
        return result;
      })
      .then((result) => { if (!cancelled) { setSettings(result); setDailyBudgetDraft(String(result.dailyBudget)); setCurrencyDraft(result.currency); setSettingsError(''); } })
      .catch((error) => { if (!cancelled) setSettingsError(error.message); })
      .finally(() => { if (!cancelled) setSettingsLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  const monthTransactions = useMemo(() => transactions.filter((item) => item.date.startsWith(monthKey(month))), [transactions, month]);
  const sortedTransactions = useMemo(() => [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)), [monthTransactions]);
  const income = monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = income - expenses;
  const today = new Date();
  const throughDay = monthKey(month) === monthKey(today) ? today.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthStart = `${monthKey(month)}-01`;
  const cutoff = `${monthKey(month)}-${String(throughDay).padStart(2, '0')}`;
  const monthToDateExpense = monthTransactions.filter((item) => item.type === 'expense' && item.date >= monthStart && item.date <= cutoff).reduce((sum, item) => sum + Number(item.amount), 0);
  const dailyBudget = Number(settings?.dailyBudget) || 0;
  const currency = settings?.currency;
  const dailySpend = throughDay ? monthToDateExpense / throughDay : 0;
  const categorySpend = monthTransactions.filter((item) => item.type === 'expense').reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + Number(item.amount) }), {});
  const categoryBreakdown = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topCategory = categoryBreakdown[0];
  const dailyAmounts = Array.from({ length: 10 }, (_, index) => {
    const day = Math.max(1, throughDay - 9 + index);
    return monthTransactions.filter((item) => item.type === 'expense' && Number(item.date.slice(-2)) === day).reduce((sum, item) => sum + Number(item.amount), 0);
  });
  const maxDailyAmount = Math.max(1, ...dailyAmounts);
  const visibleTransactions = sortedTransactions.filter((item) => {
    const matchesSearch = `${item.note} ${item.category} ${item.paymentMethod}`.toLowerCase().includes(query.toLowerCase());
    const matchesType = filterType === 'All transactions' || item.type === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  function changeMonth(amount) { setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1)); }
  function goToCurrentMonth() { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }
  function openForm(type = 'expense') {
    if (!settings) { setToast(settingsError || 'Settings are still loading from the database.'); return; }
    const typeCategories = type === 'income' ? settings.incomeCategories : settings.expenseCategories;
    setForm((current) => ({ ...current, type, amount: '', note: '', date: localDateString(), category: typeCategories[0] || '', paymentMethod: settings.paymentMethods[0] || '' }));
    setModalOpen(true);
  }
  function persistSettings(operation) {
    const request = settingsMutationQueue.current.then(async () => {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save settings.');
      setSettings(result);
      setDailyBudgetDraft(String(result.dailyBudget));
      setCurrencyDraft(result.currency);
      setSettingsError('');
      return result;
    });
    // Keep later updates flowing after one request fails; callers still receive the rejection.
    settingsMutationQueue.current = request.then(() => undefined, () => undefined);
    return request;
  }
  async function savePreference(key, value) {
    if (!settings) return;
    try { await persistSettings({ action: 'set', key, value }); setToast('Preference saved to the database.'); }
    catch (error) { setToast(error.message); }
  }
  async function addSetting(kind) {
    const value = (kind === 'payment' ? newPaymentMethod : newCategory).trim();
    if (!value) return;
    const key = kind === 'payment' ? 'paymentMethods' : `${categorySettingType}Categories`;
    try {
      await persistSettings({ action: 'add', key, value });
      setToast('Setting saved to the database.');
      if (kind === 'payment') setNewPaymentMethod('');
      else setNewCategory('');
    }
    catch (error) { setToast(error.message); }
  }
  async function removeSetting(key, value) {
    try { await persistSettings({ action: 'remove', key, value }); }
    catch (error) { setToast(error.message); return; }
    setForm((current) => ({ ...current, ...(key === 'paymentMethods' && current.paymentMethod === value ? { paymentMethod: '' } : {}), ...((key === 'incomeCategories' || key === 'expenseCategories') && current.category === value ? { category: '' } : {}) }));
  }
  async function saveTransaction(event) {
    event.preventDefault();
    if (transactionSubmission.current || !form.amount || Number(form.amount) <= 0) return;
    transactionSubmission.current = true;
    setSavingTransaction(true);
    try {
      const response = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save transaction.');
      setTransactions((current) => [result, ...current]);
      setModalOpen(false);
      setToast(`${form.type === 'expense' ? 'Expense' : 'Income'} saved to the database.`);
    } catch (error) { setToast(error.message); }
    finally { transactionSubmission.current = false; setSavingTransaction(false); }
  }
  async function deleteTransaction(id) {
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not delete transaction.');
      setTransactions((current) => current.filter((item) => item.id !== id));
      setToast('Transaction deleted from the database.');
    } catch (error) { setToast(error.message); }
  }
  function exportCsv() {
    const lines = [['Date', 'Type', 'Category', 'Note', 'Payment method', 'Amount'], ...sortedTransactions.map((item) => [item.date, item.type, item.category, item.note, item.paymentMethod, item.amount])];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `moneta-${monthKey(month)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthShort = month.toLocaleDateString('en-US', { month: 'short' });
  const pageLabels = { overview: 'Overview', friends: 'Friends', bills: 'Split bills', given: 'Money given', borrowed: 'Money borrowed', settlements: 'Settlements' };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark"><span /><span /><span /></span><span>moneta<span className="brand-period">.</span></span></a>
      <div className="workspace-switch"><div className="workspace-avatar"><Wallet size={15} /></div><div className="workspace-text"><strong>Expense tracker</strong><span>{settingsError || transactionsError ? 'Database connection needed' : settingsLoading || transactionsLoading ? 'Loading database' : 'Connected to Appwrite'}</span></div><ChevronDown size={15} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="main-nav"><button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => setActivePage('overview')}><LayoutDashboard size={17} /><span>Overview</span></button><button className={`nav-item ${activePage === 'friends' ? 'active' : ''}`} onClick={() => setActivePage('friends')}><Users size={17} /><span>Friends</span></button><button className={`nav-item ${activePage === 'bills' ? 'active' : ''}`} onClick={() => setActivePage('bills')}><ReceiptText size={17} /><span>Split bills</span></button><button className={`nav-item ${activePage === 'given' ? 'active' : ''}`} onClick={() => setActivePage('given')}><HandCoins size={17} /><span>Money given</span></button><button className={`nav-item ${activePage === 'borrowed' ? 'active' : ''}`} onClick={() => setActivePage('borrowed')}><ArrowDownLeft size={17} /><span>Money borrowed</span></button><button className={`nav-item ${activePage === 'settlements' ? 'active' : ''}`} onClick={() => setActivePage('settlements')}><ArrowDownRight size={17} /><span>Settlements</span></button><button className="nav-item" onClick={() => setActivePage('overview')}><ArrowLeftRightIcon /><span>Transactions</span><span className="nav-count">{monthTransactions.length}</span></button><button className="nav-item" onClick={() => setActivePage('overview')}><Sparkles size={17} /><span>Insights</span><span className="nav-dot" /></button></nav>
      <div className="sidebar-bottom"><button className="nav-item bottom-link" onClick={openSettings}><Settings2 size={17} /><span>Settings</span></button><div className="profile"><div className="profile-avatar"><Wallet size={14} /></div><div><strong>Account</strong><span>{settingsError ? 'Settings unavailable' : settingsLoading ? 'Loading preferences' : 'Personal workspace'}</span></div><Ellipsis size={18} /></div></div>
    </aside>

    <main className="main-content" id="dashboard">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageLabels[activePage]}</strong></div><div className="topbar-actions">{activePage === 'overview' && <button className="icon-button search-button" aria-label="Search" onClick={() => document.getElementById('transaction-search')?.focus()}><Search size={17} /></button>}<button className="avatar-button" aria-label="Account settings" onClick={openSettings}><Settings2 size={15} /></button></div></header>

      {activePage === 'overview' ? <div className="dashboard-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div><h1>Your money, <em>in perspective.</em></h1><p className="welcome-copy">A calmer view of where it comes from and where it goes.</p></div><button className="primary-button" onClick={() => openForm('expense')}><Plus size={17} strokeWidth={2.4} /> Add transaction</button></section>
        {(settingsError || transactionsError) && <div className="data-alert" role="alert">{settingsError || transactionsError} Check the server and Appwrite TablesDB configuration.</div>}
        {(settingsLoading || transactionsLoading) && <div className="load-indicator">Loading your data from the database…</div>}

        <section className="month-toolbar"><div className="month-heading"><span className="period-icon"><CalendarDays size={16} /></span><strong>{monthName}</strong><button className="month-arrow" aria-label="Previous month" onClick={() => changeMonth(-1)}><ArrowLeft size={14} /></button><button className="month-arrow" aria-label="Next month" onClick={() => changeMonth(1)}><ArrowRight size={14} /></button>{monthKey(month) === monthKey(today) && <span className="current-month-pill">THIS MONTH</span>}</div><button className="text-button" onClick={goToCurrentMonth}>Today <ArrowUpRight size={14} /></button></section>

        <section className="summary-grid">
          <article className="balance-card"><div className="card-topline"><span>Period balance</span></div><div className="balance-amount">{money(balance, false, currency)}</div><div className="balance-sub"><span className="status-dot" /> {balance >= 0 ? 'Income exceeds expenses' : 'Expenses exceed income'} <span className="sub-separator">·</span> <span>through {month.toLocaleDateString(undefined, { month: 'short' })} {throughDay}</span></div><div className="balance-divider" /><div className="balance-foot"><div><span className="foot-label">INCOME</span><strong><ArrowDownLeft size={15} />{money(income, true, currency)}</strong></div><div><span className="foot-label">SPENT</span><strong className="spent-value"><ArrowUpRight size={15} />{money(expenses, true, currency)}</strong></div><div className="balance-mini-chart" aria-label="Daily expense trend">{dailyAmounts.map((amount, index) => <span key={index} style={{ height: `${Math.max(8, (amount / maxDailyAmount) * 100)}%` }} />)}</div></div></article>
          <article className="metric-card income-card"><div className="metric-head"><span className="metric-icon income-icon"><ArrowDownLeft size={17} /></span><span className="metric-label">MONEY IN</span></div><div className="metric-value">{money(income, false, currency)}</div><div className="metric-bottom"><span className="metric-note">{monthTransactions.filter((item) => item.type === 'income').length} deposits this month</span><button className="quick-add" onClick={() => openForm('income')} aria-label="Add income"><Plus size={15} /></button></div><div className="metric-accent income-accent" /></article>
          <article className="metric-card expense-card"><div className="metric-head"><span className="metric-icon expense-icon"><ArrowUpRight size={17} /></span><span className="metric-label">MONEY OUT</span></div><div className="metric-value">{money(expenses, false, currency)}</div><div className="metric-bottom"><span className="metric-note">{monthTransactions.filter((item) => item.type === 'expense').length} expenses this month</span><button className="quick-add expense-quick" onClick={() => openForm('expense')} aria-label="Add expense"><Plus size={15} /></button></div><div className="metric-accent expense-accent" /></article>
        </section>

        <section className="content-grid"><div className="left-column">
          <article className="panel spending-panel"><div className="panel-heading"><div><div className="panel-eyebrow">THE BIG PICTURE</div><h2>Spending overview</h2></div><span className="period-select">{monthShort} 01 – {String(throughDay).padStart(2, '0')}</span></div><div className="chart-meta"><span><i className="legend-dot actual-dot" /> Daily spending</span>{dailyBudget > 0 && <span><i className="legend-dot average-dot" /> Daily budget</span>}<div className="chart-total">{money(monthToDateExpense, false, currency)} <span>total this month</span></div></div><SpendingChart transactions={monthTransactions} year={month.getFullYear()} monthIndex={month.getMonth()} throughDay={throughDay} dailyBudget={dailyBudget} currency={currency} monthLabel={monthShort} /></article>
          <article className="panel transactions-panel" id="transactions"><div className="panel-heading transactions-heading"><div><div className="panel-eyebrow">YOUR MONEY, MOVING</div><h2>Transactions <span className="transactions-count">{visibleTransactions.length}</span></h2></div><button className="see-all" onClick={exportCsv}>Export <Download size={14} /></button></div><div className="transactions-controls"><div className="transaction-search"><Search size={15} /><input id="transaction-search" placeholder="Find a transaction..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="filter-button" onClick={() => setFilterType((current) => current === 'All transactions' ? 'Expense' : current === 'Expense' ? 'Income' : 'All transactions')}><Settings2 size={14} /> {filterType} <ChevronDown size={13} /></button></div><div className="transaction-table"><div className="table-head"><span>TRANSACTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{transactionsLoading ? <div className="empty-state"><strong>Loading transactions…</strong></div> : visibleTransactions.length ? visibleTransactions.slice(0, 6).map((item) => <TransactionRow key={item.id} item={item} currency={currency} onDelete={deleteTransaction} />) : <div className="empty-state"><div className="empty-icon"><Wallet size={20} /></div><strong>{transactionsError ? 'Transactions unavailable' : 'No transactions for this month'}</strong><span>{transactionsError || 'Add a transaction to start building your monthly picture.'}</span>{!transactionsError && <button onClick={() => openForm('expense')}><Plus size={14} /> Add transaction</button>}</div>}</div></article>
        </div><aside className="right-column" id="insights">
          <article className="insight-card"><div className="insight-heading"><div className="insight-icon"><Sparkles size={17} /></div><span>YOUR MONEY NOTE</span></div><div className="insight-title">{topCategory ? <>A closer look at <em>{topCategory[0]}.</em></> : <>Your picture gets clearer <em>with each entry.</em></>}</div><p className="insight-copy">{topCategory ? `${topCategory[0]} is your leading expense at ${money(topCategory[1], false, currency)}.` : 'There are no expense entries for this month yet.'} {dailyBudget > 0 ? dailySpend > dailyBudget ? `Your daily average is ${money(dailySpend, false, currency)}, above your ${money(dailyBudget, false, currency)} guide.` : `Your daily average is within your ${money(dailyBudget, false, currency)} guide.` : 'Set a daily spending guide in Settings to compare your pace.'}</p><div className="insight-highlight"><span className="highlight-icon">✳</span><span>{topCategory ? `A 10% reduction in this category would free up about ${money(topCategory[1] * 0.1, false, currency)} next month.` : 'Add transactions to get a personalized spending summary.'}</span></div><button className="insight-link" onClick={openSettings}>Adjust your settings <ArrowUpRight size={14} /></button><div className="insight-decoration">✳</div></article>
          <article className="panel daily-panel"><div className="daily-top"><div><div className="panel-eyebrow">A GENTLE GUIDE</div><h3>Daily spending</h3></div><button className="help-button" aria-label="Set daily spending guide" onClick={openSettings}><CircleHelp size={15} /></button></div><div className="daily-number">{money(dailySpend, false, currency)}{dailyBudget > 0 && <span> / {money(dailyBudget, false, currency)} per day</span>}</div><div className="progress-track"><div className={`progress-fill ${dailyBudget > 0 && dailySpend > dailyBudget ? 'over-budget' : ''}`} style={{ width: `${dailyBudget ? Math.min(100, (dailySpend / dailyBudget) * 100) : 0}%` }} /></div><div className="daily-bottom"><span className="daily-indicator"><i className={dailyBudget > 0 && dailySpend > dailyBudget ? 'orange-indicator' : ''} />{dailyBudget ? dailySpend > dailyBudget ? 'Above your daily guide' : 'Within your daily guide' : 'Add a daily guide in Settings'}</span><span>{dailyBudget ? `${Math.round((dailySpend / dailyBudget) * 100)}%` : '—'}</span></div></article>
          <article className="panel categories-panel"><div className="categories-header"><div><div className="panel-eyebrow">WHERE IT GOES</div><h3>Top categories</h3></div><span className="see-categories">{monthShort}</span></div>{categoryBreakdown.length ? <div className="category-list">{categoryBreakdown.map(([name]) => <div className="category-row" key={name}><span className="category-mark" style={{ backgroundColor: colorForCategory(name) }}><Tag size={13} /></span><span className="category-name">{name}</span><div className="category-progress"><span style={{ width: `${expenses ? Math.max(7, categorySpend[name] / expenses * 100) : 0}%`, backgroundColor: colorForCategory(name) }} /></div><span className="category-amount">{money(categorySpend[name], true, currency)}</span></div>)}</div> : <div className="category-empty">No expense categories recorded this month.</div>}<button className="all-category-link" onClick={() => document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })}>View transactions <ArrowUpRight size={14} /></button></article>
          <div className="help-footer"><span>Made for mindful money</span><span>·</span><button onClick={() => setToast('Help center is coming soon.')}>Need a hand?</button></div>
        </aside></section>
        <footer className="page-footer"><span>© {new Date().getFullYear()} Moneta</span><span>Your finances, held with care <span className="footer-heart">♥</span></span><span>{transactionsError || settingsError ? 'Database connection unavailable' : 'Synced with your database'} <i /></span></footer>
      </div> : <FriendsWorkspace page={activePage} settings={settings} onToast={setToast} />}
    </main>
    {modalOpen && settings && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}><form className="transaction-modal" onSubmit={saveTransaction}><div className="modal-heading"><div><div className="panel-eyebrow">A SMALL MONEY MOMENT</div><h2>Add a transaction</h2></div><button className="close-button" type="button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="type-switch"><button type="button" className={form.type === 'expense' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'expense', category: settings.expenseCategories[0] || '' })}><ArrowUpRight size={15} /> Expense</button><button type="button" className={form.type === 'income' ? 'selected income-selected' : ''} onClick={() => setForm({ ...form, type: 'income', category: settings.incomeCategories[0] || '' })}><ArrowDownLeft size={15} /> Income</button></div><label className="field-label">AMOUNT <span>{currency} · {currencySymbol(currency)}</span><div className="amount-input"><span>{currencySymbol(currency)}</span><input autoFocus type="number" min="0.01" step="0.01" placeholder="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></div></label><div className="form-row"><label className="field-label">CATEGORY<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="" disabled>{(form.type === 'income' ? settings.incomeCategories : settings.expenseCategories).length ? 'Choose a category' : 'Add categories in Settings'}</option>{(form.type === 'income' ? settings.incomeCategories : settings.expenseCategories).map((category) => <option key={category} value={category}>{category}</option>)}</select>{!(form.type === 'income' ? settings.incomeCategories : settings.expenseCategories).length && <button type="button" className="field-help-link" onClick={() => { setModalOpen(false); setSettingsOpen(true); setCategorySettingType(form.type); }}>Add category in Settings</button>}</label><label className="field-label">DATE<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label></div><div className="form-row"><label className="field-label">PAYMENT METHOD<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} required><option value="" disabled>{settings.paymentMethods.length ? 'Choose a method' : 'Add methods in Settings'}</option>{settings.paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select>{!settings.paymentMethods.length && <button type="button" className="field-help-link" onClick={() => { setModalOpen(false); setSettingsOpen(true); }}>Add payment method in Settings</button>}</label><label className="field-label">NOTE <span>OPTIONAL</span><input type="text" placeholder="What was it for?" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={savingTransaction || !form.category || !form.paymentMethod}><Plus size={16} /> Add {form.type}</button></div><div className="modal-reassurance"><Sparkles size={13} /> Saved to your personal database.</div></form></div>}
    {settingsOpen && settings && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><section className="transaction-modal settings-modal"><div className="modal-heading"><div><div className="panel-eyebrow">PREFERENCES</div><h2>Settings</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close"><X size={18} /></button></div><p className="settings-intro">These preferences are stored in your Appwrite database and used across the dashboard.</p><div className="settings-section"><div className="settings-section-heading"><div><span className="field-label-title">CATEGORIES</span><p>Categories available for income or expenses.</p></div><select className="settings-type-select" value={categorySettingType} onChange={(event) => setCategorySettingType(event.target.value)}><option value="expense">Expenses</option><option value="income">Income</option></select></div><div className="setting-entry"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addSetting('category'))} placeholder="Add a category" /><button className="primary-button" onClick={() => addSetting('category')}><Plus size={15} /> Add</button></div><SettingList items={settings[`${categorySettingType}Categories`]} onRemove={(value) => removeSetting(`${categorySettingType}Categories`, value)} /></div><div className="settings-section"><div className="settings-section-heading"><div><span className="field-label-title">PAYMENT METHODS</span><p>Available payment methods for transactions.</p></div></div><div className="setting-entry"><input value={newPaymentMethod} onChange={(event) => setNewPaymentMethod(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addSetting('payment'))} placeholder="Add a payment method" /><button className="primary-button" onClick={() => addSetting('payment')}><Plus size={15} /> Add</button></div><SettingList items={settings.paymentMethods} onRemove={(value) => removeSetting('paymentMethods', value)} /></div><div className="settings-section preferences-fields"><label className="field-label">DAILY SPENDING GUIDE<input type="number" min="0" step="0.01" value={dailyBudgetDraft} onChange={(event) => setDailyBudgetDraft(event.target.value)} onBlur={() => savePreference('dailyBudget', Number(dailyBudgetDraft))} /></label><label className="field-label">CURRENCY CODE<input type="text" maxLength="3" value={currencyDraft} onChange={(event) => setCurrencyDraft(event.target.value.toUpperCase())} onBlur={() => savePreference('currency', currencyDraft.toUpperCase())} /></label></div><div className="modal-actions"><button className="primary-button" onClick={() => setSettingsOpen(false)}>Done</button></div></section></div>}
    {toast && <div className="toast"><span><Sparkles size={15} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={14} /></button></div>}
  </div>;
}

function ArrowLeftRightIcon() { return <ArrowDownRight size={17} />; }

function SettingList({ items, onRemove }) {
  return items.length ? <div className="settings-chip-list">{items.map((item) => <span className="settings-chip" key={item}>{item}<button onClick={() => onRemove(item)} aria-label={`Remove ${item}`}><X size={12} /></button></span>)}</div> : <div className="settings-empty">Nothing added yet.</div>;
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function TransactionRow({ item, currency, onDelete }) {
  const symbol = item.category?.trim().charAt(0).toUpperCase() || '•';
  return <div className="transaction-row"><span className={`transaction-symbol ${item.type === 'income' ? 'symbol-income' : ''}`} style={{ '--symbol-color': colorForCategory(item.category) }}>{symbol}</span><span className="transaction-description"><strong>{item.note || item.category}</strong><span>{item.paymentMethod}</span></span><span className="transaction-category"><i style={{ backgroundColor: colorForCategory(item.category) }} />{item.category}</span><span className="transaction-date">{dateLabel(item.date)}</span><span className={`transaction-amount ${item.type === 'income' ? 'amount-income' : ''}`}>{item.type === 'income' ? '+' : '−'}{money(item.amount, false, currency)}</span><button className="delete-transaction" onClick={() => onDelete(item.id)} aria-label="Delete transaction"><Trash2 size={14} /></button></div>;
}

function SpendingChart({ transactions, year, monthIndex, throughDay, dailyBudget, currency, monthLabel }) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const [hovered, setHovered] = useState(null);
  const spendingByDay = useMemo(() => {
    const totals = Array(daysInMonth).fill(0);
    transactions.filter((item) => item.type === 'expense').forEach((item) => { const day = Number(item.date.slice(-2)); totals[day - 1] += Number(item.amount); });
    return totals;
  }, [transactions, daysInMonth]);
  const max = Math.max(...spendingByDay, dailyBudget, 100) * 1.2;
  const values = spendingByDay.slice(0, throughDay);
  const chartWidth = 640; const chartHeight = 176; const top = 12; const bottom = 143;
  const x = (index) => 15 + index * (610 / Math.max(1, daysInMonth - 1));
  const y = (value) => bottom - (value / max) * (bottom - top);
  const actualLine = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`).join(' ');
  const area = `${actualLine} L ${x(Math.max(0, values.length - 1))} ${bottom} L ${x(0)} ${bottom} Z`;
  const targetLine = dailyBudget > 0 ? `M ${x(0)} ${y(dailyBudget)} L ${x(daysInMonth - 1)} ${y(dailyBudget)}` : '';
  const xLabels = [1, 5, 10, 15, 20, 25, daysInMonth].filter((value, index, arr) => arr.indexOf(value) === index);
  return <div className="chart-shell"><div className="chart-y-labels"><span>{money(max, true, currency)}</span><span>{money(max / 2, true, currency)}</span><span>{money(0, true, currency)}</span></div><svg className="spending-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" onMouseLeave={() => setHovered(null)}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d3e96b" stopOpacity=".18" /><stop offset="100%" stopColor="#d3e96b" stopOpacity="0" /></linearGradient></defs>{[top, (top + bottom) / 2, bottom].map((lineY) => <line key={lineY} x1="0" x2={chartWidth} y1={lineY} y2={lineY} className="chart-gridline" />)}{targetLine && <path d={targetLine} className="target-line" />}<path d={area} fill="url(#chartFill)" /><path d={actualLine} className="actual-line" />{values.map((value, index) => <g key={index} onMouseEnter={() => setHovered(index)}><circle cx={x(index)} cy={y(value)} r="8" fill="transparent" /><circle cx={x(index)} cy={y(value)} r={hovered === index ? 4 : 2.5} className="chart-point" />{hovered === index && <g><rect x={Math.max(0, x(index) - 45)} y={Math.max(2, y(value) - 32)} width="90" height="23" rx="6" fill="#30322e" /><text x={x(index)} y={Math.max(17, y(value) - 17)} textAnchor="middle" className="chart-tooltip">{money(value, false, currency)} · {monthLabel} {index + 1}</text></g>}</g>)}</svg><div className="chart-x-labels">{xLabels.map((day) => <span key={day}>{day === 1 ? `${new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' })} ${String(day).padStart(2, '0')}` : String(day).padStart(2, '0')}</span>)}</div></div>;
}

export default App;

