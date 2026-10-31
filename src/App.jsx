import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, CircleHelp, CreditCard, Download, Ellipsis, Gem, LayoutDashboard, Plus, Search, Settings2, Sparkles, Tag, Trash2, Wallet, X } from 'lucide-react';

const STORAGE_KEY = 'moneta-transactions-v1';
const now = new Date();
const demoTransactions = [
  ['income', 8200, 'Salary', 'Monthly salary', 1, 'Bank transfer'],
  ['expense', 1240, 'Food & dining', 'Dinner with friends', Math.max(1, now.getDate() - 3), 'Card'],
  ['expense', 680, 'Transport', 'Uber rides', Math.max(1, now.getDate() - 4), 'Card'],
  ['expense', 2450, 'Shopping', 'A little treat', Math.max(1, now.getDate() - 6), 'Card'],
  ['income', 450, 'Freelance', 'Brand identity project', Math.max(1, now.getDate() - 7), 'Bank transfer'],
  ['expense', 320, 'Food & dining', 'Sunday brunch', Math.max(1, now.getDate() - 8), 'Card'],
  ['expense', 980, 'Bills & utilities', 'Internet + electricity', Math.max(1, now.getDate() - 10), 'Bank transfer'],
  ['expense', 540, 'Health', 'Yoga membership', Math.max(1, now.getDate() - 12), 'Card'],
  ['expense', 410, 'Transport', 'Metro pass', Math.max(1, now.getDate() - 14), 'Card'],
  ['income', 120, 'Cashback', 'Card rewards', Math.max(1, now.getDate() - 16), 'Bank transfer'],
].map(([type, amount, category, note, day, paymentMethod], index) => ({ id: `demo-${index}`, type, amount, category, note, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, paymentMethod }));

const money = (value, compact = false) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard' }).format(value);
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const categoryColors = { 'Food & dining': '#d3e96b', Transport: '#a894f4', Shopping: '#f5ae75', 'Bills & utilities': '#71c7ae', Health: '#ee8799', Entertainment: '#71a3f0', Salary: '#d3e96b', Freelance: '#a894f4', Cashback: '#71c7ae', Other: '#888a84' };

function App() {
  const [transactions, setTransactions] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) : demoTransactions; } catch { return demoTransactions; }
  });
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('All transactions');
  const [form, setForm] = useState({ type: 'expense', amount: '', category: 'Food & dining', note: '', date: localDateString(), paymentMethod: 'Card' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions?month=${monthKey(month)}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => {
        if (cancelled || result.mode !== 'appwrite') return;
        setTransactions((current) => [...current.filter((item) => !item.id?.startsWith('demo-') && !item.id?.startsWith('a')), ...result.transactions]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }, [transactions]);
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
  const dailyBudget = 150;
  const dailySpend = throughDay ? monthToDateExpense / throughDay : 0;
  const categorySpend = monthTransactions.filter((item) => item.type === 'expense').reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + Number(item.amount) }), {});
  const categoryBreakdown = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topCategory = categoryBreakdown[0];
  const visibleTransactions = sortedTransactions.filter((item) => {
    const matchesSearch = `${item.note} ${item.category} ${item.paymentMethod}`.toLowerCase().includes(query.toLowerCase());
    const matchesType = filterType === 'All transactions' || item.type === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  function changeMonth(amount) { setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1)); }
  function openForm(type = 'expense') {
    setForm((current) => ({ ...current, type, amount: '', note: '', date: localDateString() }));
    setModalOpen(true);
  }
  function saveTransaction(event) {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    const transaction = { ...form, id: crypto.randomUUID(), amount: Number(form.amount) };
    setTransactions((current) => [transaction, ...current]);
    fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(async (response) => {
        if (!response.ok) return;
        const saved = await response.json();
        setTransactions((current) => current.map((item) => item.id === transaction.id ? saved : item));
      })
      .catch(() => {});
    setModalOpen(false);
    setToast(`${form.type === 'expense' ? 'Expense' : 'Income'} added. Your money picture is up to date.`);
  }
  function deleteTransaction(id) {
    setTransactions((current) => current.filter((item) => item.id !== id));
    if (!id.startsWith('demo-') && !id.startsWith('a')) fetch(`/api/transactions/${id}`, { method: 'DELETE' }).catch(() => {});
    setToast('Transaction removed. Your totals have been updated.');
  }
  function exportCsv() {
    const lines = [['Date', 'Type', 'Category', 'Note', 'Payment method', 'Amount'], ...sortedTransactions.map((item) => [item.date, item.type, item.category, item.note, item.paymentMethod, item.amount])];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `moneta-${monthKey(month)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthShort = month.toLocaleDateString('en-US', { month: 'short' });

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark"><span /><span /><span /></span><span>moneta<span className="brand-period">.</span></span></a>
      <div className="workspace-switch"><div className="workspace-avatar">S</div><div className="workspace-text"><strong>Studio account</strong><span>Personal workspace</span></div><ChevronDown size={15} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="main-nav"><a className="nav-item active" href="#dashboard"><LayoutDashboard size={17} /><span>Overview</span></a><a className="nav-item" href="#transactions"><ArrowLeftRightIcon /><span>Transactions</span><span className="nav-count">{monthTransactions.length}</span></a><a className="nav-item" href="#insights"><Sparkles size={17} /><span>Insights</span><span className="nav-dot" /></a><a className="nav-item" href="#budgets"><Wallet size={17} /><span>Budgets</span></a></nav>
      <div className="side-label categories-label">YOUR CATEGORIES <button aria-label="Add category"><Plus size={14} /></button></div>
      <div className="category-nav"><a href="#food"><span className="category-dot" style={{ background: '#d3e96b' }} />Food & dining</a><a href="#transport"><span className="category-dot" style={{ background: '#a894f4' }} />Transport</a><a href="#shopping"><span className="category-dot" style={{ background: '#f5ae75' }} />Shopping</a><a href="#bills"><span className="category-dot" style={{ background: '#71c7ae' }} />Bills & utilities</a><a href="#health"><span className="category-dot" style={{ background: '#ee8799' }} />Health</a><a className="all-categories" href="#categories"><Plus size={14} />Add category</a></div>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-spark"><Gem size={17} /></div><strong>A little more clarity?</strong><p>Set a budget and make your next goal feel closer.</p><button onClick={() => { setToast('Budget planning is ready for your next step.'); }}>Explore budgets <ArrowUpRight size={14} /></button><div className="upgrade-orb" /></div><a className="nav-item bottom-link" href="#settings"><Settings2 size={17} /><span>Settings</span></a><div className="profile"><div className="profile-avatar">S</div><div><strong>Sam Bhavsar</strong><span>Free plan</span></div><Ellipsis size={18} /></div></div>
    </aside>

    <main className="main-content" id="dashboard">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Overview</strong></div><div className="topbar-actions"><button className="icon-button search-button" aria-label="Search" onClick={() => document.getElementById('transaction-search')?.focus()}><Search size={17} /></button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You’re all caught up.')}><Bell size={17} /><i /></button><span className="top-divider" /><button className="avatar-button" aria-label="Account">S</button></div></header>

      <div className="dashboard-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div><h1>Your money, <em>in perspective.</em></h1><p className="welcome-copy">A calmer view of where it comes from and where it goes.</p></div><button className="primary-button" onClick={() => openForm('expense')}><Plus size={17} strokeWidth={2.4} /> Add transaction</button></section>

        <section className="month-toolbar"><div className="month-heading"><span className="period-icon"><CalendarDays size={16} /></span><strong>{monthName}</strong><button className="month-arrow" aria-label="Previous month" onClick={() => changeMonth(-1)}><ArrowLeft size={14} /></button><button className="month-arrow" aria-label="Next month" onClick={() => changeMonth(1)}><ArrowRight size={14} /></button><span className="current-month-pill">THIS MONTH</span></div><button className="text-button" onClick={() => changeMonth(0)}>Today <ArrowUpRight size={14} /></button></section>

        <section className="summary-grid">
          <article className="balance-card"><div className="card-topline"><span>Available balance</span><button className="more-button" aria-label="Balance options"><Ellipsis size={18} /></button></div><div className="balance-amount">{money(balance)}</div><div className="balance-sub"><span className="status-dot" /> {balance >= 0 ? 'Looking balanced' : 'Spending is ahead'} <span className="sub-separator">·</span> <span>as of {month.toLocaleDateString('en-US', { month: 'short' })} {throughDay}</span></div><div className="balance-divider" /><div className="balance-foot"><div><span className="foot-label">INCOME</span><strong><ArrowDownLeft size={15} />{money(income, true)}</strong></div><div><span className="foot-label">SPENT</span><strong className="spent-value"><ArrowUpRight size={15} />{money(expenses, true)}</strong></div><div className="balance-mini-chart" aria-label="Income and expense trend"><span style={{ height: '30%' }} /><span style={{ height: '45%' }} /><span style={{ height: '37%' }} /><span style={{ height: '58%' }} /><span style={{ height: '46%' }} /><span style={{ height: '73%' }} /><span style={{ height: '61%' }} /><span style={{ height: '88%' }} /><span style={{ height: '70%' }} /><span style={{ height: '100%' }} /></div></div></article>
          <article className="metric-card income-card"><div className="metric-head"><span className="metric-icon income-icon"><ArrowDownLeft size={17} /></span><span className="metric-label">MONEY IN</span><button className="metric-menu" aria-label="Income options"><Ellipsis size={17} /></button></div><div className="metric-value">{money(income)}</div><div className="metric-bottom"><span className="metric-note">Across {monthTransactions.filter((item) => item.type === 'income').length} deposits</span><button className="quick-add" onClick={() => openForm('income')} aria-label="Add income"><Plus size={15} /></button></div><div className="metric-accent income-accent" /></article>
          <article className="metric-card expense-card"><div className="metric-head"><span className="metric-icon expense-icon"><ArrowUpRight size={17} /></span><span className="metric-label">MONEY OUT</span><button className="metric-menu" aria-label="Expense options"><Ellipsis size={17} /></button></div><div className="metric-value">{money(expenses)}</div><div className="metric-bottom"><span className="metric-note">Across {monthTransactions.filter((item) => item.type === 'expense').length} purchases</span><button className="quick-add expense-quick" onClick={() => openForm('expense')} aria-label="Add expense"><Plus size={15} /></button></div><div className="metric-accent expense-accent" /></article>
        </section>

        <section className="content-grid"><div className="left-column">
          <article className="panel spending-panel"><div className="panel-heading"><div><div className="panel-eyebrow">THE BIG PICTURE</div><h2>Spending overview</h2></div><button className="period-select" onClick={() => setToast(`${monthName} overview selected.`)}>{monthShort} 01 – {String(throughDay).padStart(2, '0')} <ChevronDown size={14} /></button></div><div className="chart-meta"><span><i className="legend-dot actual-dot" /> Daily spending</span><span><i className="legend-dot average-dot" /> Your daily average</span><div className="chart-total">{money(monthToDateExpense)} <span>total this month</span></div></div><SpendingChart transactions={monthTransactions} year={month.getFullYear()} monthIndex={month.getMonth()} throughDay={throughDay} dailyBudget={dailyBudget} /></article>
          <article className="panel transactions-panel" id="transactions"><div className="panel-heading transactions-heading"><div><div className="panel-eyebrow">YOUR MONEY, MOVING</div><h2>Recent transactions <span className="transactions-count">{visibleTransactions.length}</span></h2></div><button className="see-all" onClick={exportCsv}>Export <Download size={14} /></button></div><div className="transactions-controls"><div className="transaction-search"><Search size={15} /><input id="transaction-search" placeholder="Find a transaction..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div><button className="filter-button" onClick={() => setFilterType((current) => current === 'All transactions' ? 'Expense' : current === 'Expense' ? 'Income' : 'All transactions')}><Settings2 size={14} /> {filterType} <ChevronDown size={13} /></button></div><div className="transaction-table"><div className="table-head"><span>TRANSACTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{visibleTransactions.length ? visibleTransactions.slice(0, 6).map((item) => <TransactionRow key={item.id} item={item} onDelete={deleteTransaction} />) : <div className="empty-state"><div className="empty-icon"><Wallet size={20} /></div><strong>No transactions here yet</strong><span>Add one and your money story starts to take shape.</span><button onClick={() => openForm('expense')}><Plus size={14} /> Add transaction</button></div>}</div></article>
        </div><aside className="right-column" id="insights">
          <article className="insight-card"><div className="insight-heading"><div className="insight-icon"><Sparkles size={17} /></div><span>YOUR MONEY NOTE</span><button onClick={() => setToast('A fresh money note is on the way.')} aria-label="More insights"><Ellipsis size={17} /></button></div><div className="insight-title">A little more <em>room to breathe.</em></div><p className="insight-copy">{topCategory ? `${topCategory[0]} is your biggest category this month at ${money(topCategory[1])}.` : 'Start tracking a few transactions to discover where your money is going.'} {dailySpend > dailyBudget ? `You’re averaging ${money(dailySpend)} a day, above your ${money(dailyBudget)} daily guide.` : 'Your spending is within the daily guide you set.'}</p><div className="insight-highlight"><span className="highlight-icon">✳</span><span>{topCategory ? `Small shift, big picture. Try setting aside ${money(Math.max(0, Math.round((topCategory[1] * 0.1) / 10) * 10))} from ${topCategory[0].toLowerCase()} next month.` : 'Add a few expenses and I’ll share a personal nudge.'}</span></div><button className="insight-link" onClick={() => document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })}>Explore your spending <ArrowUpRight size={14} /></button><div className="insight-decoration">✳</div></article>
          <article className="panel daily-panel"><div className="daily-top"><div><div className="panel-eyebrow">A GENTLE GUIDE</div><h3>Daily spending</h3></div><button className="help-button" aria-label="About daily spending" onClick={() => setToast('Daily guide compares your monthly spending so far with a ₹150 per-day target.')}><CircleHelp size={15} /></button></div><div className="daily-number">{money(dailySpend)}<span> / {money(dailyBudget)} per day</span></div><div className="progress-track"><div className={`progress-fill ${dailySpend > dailyBudget ? 'over-budget' : ''}`} style={{ width: `${Math.min(100, (dailySpend / dailyBudget) * 100)}%` }} /></div><div className="daily-bottom"><span className="daily-indicator"><i className={dailySpend > dailyBudget ? 'orange-indicator' : ''} />{dailySpend > dailyBudget ? 'A little above your guide' : 'Within your daily guide'}</span><span>{Math.round((dailySpend / dailyBudget) * 100)}%</span></div></article>
          <article className="panel categories-panel"><div className="categories-header"><div><div className="panel-eyebrow">WHERE IT GOES</div><h3>Top categories</h3></div><button className="see-categories" onClick={() => setToast('Showing your leading spending categories.')}>This month <ChevronDown size={13} /></button></div>{categoryBreakdown.length ? <div className="category-list">{categoryBreakdown.map(([name, amount]) => <div className="category-row" key={name}><span className="category-mark" style={{ backgroundColor: categoryColors[name] || '#a894f4' }}><Tag size={13} /></span><span className="category-name">{name}</span><div className="category-progress"><span style={{ width: `${expenses ? Math.max(7, amount / expenses * 100) : 0}%`, backgroundColor: categoryColors[name] || '#a894f4' }} /></div><span className="category-amount">{money(amount, true)}</span></div>)}</div> : <div className="category-empty">Your categories will appear here.</div>}<button className="all-category-link" onClick={() => setToast('Category breakdown updated.')}>See category breakdown <ArrowUpRight size={14} /></button></article>
          <div className="help-footer"><span>Made for mindful money</span><span>·</span><button onClick={() => setToast('Help center is coming soon.')}>Need a hand?</button></div>
        </aside></section>
        <footer className="page-footer"><span>© 2026 Moneta</span><span>Your finances, held with care <span className="footer-heart">♥</span></span><button onClick={() => setToast('You’re all caught up.')}>All systems lovely <i /></button></footer>
      </div>
    </main>
    {modalOpen && <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}><form className="transaction-modal" onSubmit={saveTransaction}><div className="modal-heading"><div><div className="panel-eyebrow">A SMALL MONEY MOMENT</div><h2>Add a transaction</h2></div><button className="close-button" type="button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="type-switch"><button type="button" className={form.type === 'expense' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'expense', category: 'Food & dining' })}><ArrowUpRight size={15} /> Expense</button><button type="button" className={form.type === 'income' ? 'selected income-selected' : ''} onClick={() => setForm({ ...form, type: 'income', category: 'Salary' })}><ArrowDownLeft size={15} /> Income</button></div><label className="field-label">AMOUNT <span>INR · ₹</span><div className="amount-input"><span>₹</span><input autoFocus type="number" min="1" step="1" placeholder="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></div></label><div className="form-row"><label className="field-label">CATEGORY<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{(form.type === 'income' ? ['Salary', 'Freelance', 'Cashback', 'Gift', 'Other'] : ['Food & dining', 'Transport', 'Shopping', 'Bills & utilities', 'Health', 'Entertainment', 'Other']).map((category) => <option key={category}>{category}</option>)}</select></label><label className="field-label">DATE<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label></div><div className="form-row"><label className="field-label">PAYMENT METHOD<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option>Card</option><option>Cash</option><option>Bank transfer</option><option>UPI</option></select></label><label className="field-label">NOTE <span>OPTIONAL</span><input type="text" placeholder="What was it for?" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} /> Add {form.type}</button></div><div className="modal-reassurance"><Sparkles size={13} /> This stays in your personal money space.</div></form></div>}
    {toast && <div className="toast"><span><Sparkles size={15} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={14} /></button></div>}
  </div>;
}

function ArrowLeftRightIcon() { return <ArrowDownRight size={17} />; }

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function TransactionRow({ item, onDelete }) {
  const symbol = { Salary: 'S', 'Food & dining': 'F', Transport: '↗', Shopping: '✳', Freelance: '✦', 'Bills & utilities': '⌁', Health: '♡', Cashback: '↙' }[item.category] || '•';
  return <div className="transaction-row"><span className={`transaction-symbol ${item.type === 'income' ? 'symbol-income' : ''}`} style={{ '--symbol-color': categoryColors[item.category] || '#a894f4' }}>{symbol}</span><span className="transaction-description"><strong>{item.note || item.category}</strong><span>{item.paymentMethod}</span></span><span className="transaction-category"><i style={{ backgroundColor: categoryColors[item.category] || '#a894f4' }} />{item.category}</span><span className="transaction-date">{dateLabel(item.date)}</span><span className={`transaction-amount ${item.type === 'income' ? 'amount-income' : ''}`}>{item.type === 'income' ? '+' : '−'}{money(item.amount)}</span><button className="delete-transaction" onClick={() => onDelete(item.id)} aria-label="Delete transaction"><Trash2 size={14} /></button></div>;
}

function SpendingChart({ transactions, year, monthIndex, throughDay, dailyBudget }) {
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
  const targetLine = `M ${x(0)} ${y(dailyBudget)} L ${x(daysInMonth - 1)} ${y(dailyBudget)}`;
  const xLabels = [1, 5, 10, 15, 20, 25, daysInMonth].filter((value, index, arr) => arr.indexOf(value) === index);
  return <div className="chart-shell"><div className="chart-y-labels"><span>{money(max, true)}</span><span>{money(max / 2, true)}</span><span>₹0</span></div><svg className="spending-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" onMouseLeave={() => setHovered(null)}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d3e96b" stopOpacity=".18" /><stop offset="100%" stopColor="#d3e96b" stopOpacity="0" /></linearGradient></defs>{[top, (top + bottom) / 2, bottom].map((lineY) => <line key={lineY} x1="0" x2={chartWidth} y1={lineY} y2={lineY} className="chart-gridline" />)}<path d={targetLine} className="target-line" /><path d={area} fill="url(#chartFill)" /><path d={actualLine} className="actual-line" />{values.map((value, index) => <g key={index} onMouseEnter={() => setHovered(index)}><circle cx={x(index)} cy={y(value)} r="8" fill="transparent" /><circle cx={x(index)} cy={y(value)} r={hovered === index ? 4 : 2.5} className="chart-point" />{hovered === index && <g><rect x={Math.max(0, x(index) - 45)} y={Math.max(2, y(value) - 32)} width="90" height="23" rx="6" fill="#30322e" /><text x={x(index)} y={Math.max(17, y(value) - 17)} textAnchor="middle" className="chart-tooltip">{money(value)} · Oct {index + 1}</text></g>}</g>)}</svg><div className="chart-x-labels">{xLabels.map((day) => <span key={day}>{day === 1 ? `${new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' })} ${String(day).padStart(2, '0')}` : String(day).padStart(2, '0')}</span>)}</div></div>;
}

export default App;
