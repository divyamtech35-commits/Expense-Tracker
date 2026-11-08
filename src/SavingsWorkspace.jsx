import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';
import './savings.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatMoney = (value, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `₹${Number(value || 0).toFixed(2)}`; }
};

const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function SavingsWorkspace({ settings, onToast }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'deposit', amount: '', date: today(), description: '', paymentMethod: '' });
  const currency = settings?.currency || 'INR';

  async function refresh() {
    try {
      const response = await fetch('/api/savings');
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not load savings.');
      setSummary(result);
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not save this savings entry.');
      setForm((current) => ({ ...current, amount: '', description: '', date: today() }));
      await refresh();
      onToast(form.type === 'deposit' ? 'Savings amount added.' : 'Expense recorded from savings.');
    } catch (cause) {
      onToast(cause.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry) {
    if (!window.confirm(`Delete this ${entry.type === 'deposit' ? 'savings deposit' : 'savings expense'}? The savings totals will be adjusted.`)) return;
    setDeletingId(entry.id);
    try {
      const response = await fetch(`/api/savings/${entry.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not delete this savings entry.');
      await refresh();
      onToast('Savings entry deleted and totals adjusted.');
    } catch (cause) {
      onToast(cause.message);
    } finally {
      setDeletingId('');
    }
  }

  return <div className="savings-wrap">
    <header className="savings-heading">
      <div><div className="panel-eyebrow">YOUR SAVINGS</div><h1>A little saved, <em>a lot of peace.</em></h1><p>Keep savings deposits and spending here, separate from your regular transactions.</p></div>
      <div className="savings-heading-icon"><PiggyBank size={22} /></div>
    </header>

    {error && <div className="data-alert" role="alert">{error} Run <code>npm run setup:appwrite</code> if the Savings tables have not been created.</div>}

    <section className="savings-summary">
      <article className="savings-balance-card"><span className="savings-card-label"><Wallet size={15} /> AVAILABLE SAVINGS</span><strong>{loading ? '—' : formatMoney(summary?.balance, currency)}</strong><small>Current amount left in your savings</small></article>
      <article className="savings-stat-card"><span>ADDED TO SAVINGS</span><strong>{loading ? '—' : formatMoney(summary?.totalAdded, currency)}</strong><small>All deposits</small></article>
      <article className="savings-stat-card"><span>SPENT FROM SAVINGS</span><strong>{loading ? '—' : formatMoney(summary?.totalSpent, currency)}</strong><small>All withdrawals</small></article>
    </section>

    <section className="savings-content">
      <article className="savings-panel savings-entry-panel">
        <div className="savings-panel-heading"><div><div className="panel-eyebrow">SAVE OR SPEND</div><h2>Record savings activity</h2></div></div>
        <div className="savings-type-switch" role="group" aria-label="Savings activity type">
          <button type="button" className={form.type === 'deposit' ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, type: 'deposit' }))}><ArrowDownToLine size={15} /> Add savings</button>
          <button type="button" className={form.type === 'withdrawal' ? 'selected spend-selected' : ''} onClick={() => setForm((current) => ({ ...current, type: 'withdrawal' }))}><ArrowUpFromLine size={15} /> Spend from savings</button>
        </div>
        <form className="savings-form" onSubmit={submit}>
          <label>AMOUNT<input type="number" min="0.01" step="0.01" max={form.type === 'withdrawal' ? summary?.balance : undefined} required placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
          <label>DATE<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          <label className="savings-wide-field">DESCRIPTION<input type="text" maxLength="255" required placeholder={form.type === 'deposit' ? 'e.g. Monthly savings' : 'What did you use savings for?'} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="savings-wide-field">PAYMENT METHOD <span className="savings-optional">OPTIONAL</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="">Not specified</option>{(settings?.paymentMethods || []).map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
          <div className="savings-form-actions"><button className={`savings-submit ${form.type === 'withdrawal' ? 'spend-submit' : ''}`} type="submit" disabled={saving || loading || !summary}><Plus size={16} />{saving ? 'Saving…' : form.type === 'deposit' ? 'Add to savings' : 'Record savings expense'}</button></div>
        </form>
      </article>

      <article className="savings-panel savings-history-panel">
        <div className="savings-panel-heading"><div><div className="panel-eyebrow">SAVINGS LEDGER</div><h2>Activity history <span>{summary?.entries?.length || 0}</span></h2></div></div>
        {loading ? <div className="savings-empty">Loading savings activity…</div> : summary?.entries?.length ? <div className="savings-ledger">{summary.entries.map((entry) => <div className="savings-ledger-row" key={entry.id}>
          <span className={`savings-ledger-icon ${entry.type === 'deposit' ? 'is-deposit' : 'is-withdrawal'}`}>{entry.type === 'deposit' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</span>
          <span className="savings-ledger-copy"><strong>{entry.description}</strong><small>{entry.type === 'deposit' ? 'Added to savings' : 'Spent from savings'} · {formatDate(entry.date)}{entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}</small></span>
          <strong className={`savings-ledger-amount ${entry.type === 'deposit' ? 'is-deposit' : 'is-withdrawal'}`}>{entry.type === 'deposit' ? '+' : '−'}{formatMoney(entry.amount, currency)}</strong>
          <button className="savings-delete" type="button" disabled={deletingId === entry.id} onClick={() => removeEntry(entry)} aria-label={`Delete ${entry.type === 'deposit' ? 'savings deposit' : 'savings expense'}: ${entry.description}`} title="Delete entry"><Trash2 size={14} /></button>
        </div>)}</div> : <div className="savings-empty"><div><PiggyBank size={21} /></div><strong>No savings activity yet</strong><span>Add your first savings amount above to get started.</span></div>}
      </article>
    </section>
    <p className="savings-note">Savings activity is stored separately and does not appear in your main dashboard transactions, income, or expenses.</p>
  </div>;
}
