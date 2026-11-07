import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ASSETS, EVENT } from '../config/event.js';
import { filterResponses, summarise } from '../../shared/rsvpFilters.js';
import { ApiError, checkSession, deleteRsvp, deleteRsvps, downloadCsv, fetchResponses, login, logout } from './api.js';
import { ConfirmDelete, EditRsvp } from './Dialogs.jsx';

const TZ = EVENT.timeZone;
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const refreshedFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const formatWhen = (iso) => {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
};

/* ---------------- PIN sign-in ---------------- */
function Login({ notice, onSignedIn }) {
  const id = useId();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function submit(value = pin) {
    if (busy) return;
    if (!/^\d{4}$/.test(value)) {
      setError('Please enter the 4-digit PIN.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(value);
      onSignedIn();
    } catch (err) {
      setError(err.message);
      setPin('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  const onChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
    if (error) setError('');
    if (value.length === 4) submit(value); // signs in as soon as the 4th digit is typed
  };

  return (
    <main className="login">
      <form
        className="login__card"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <img className="login__logo" src={ASSETS.logoTitle.src} alt="Magical Birthday" width={ASSETS.logoTitle.width} height={ASSETS.logoTitle.height} />
        <h1 className="login__title">RSVP dashboard</h1>
        <p className="login__sub">Enter the 4-digit PIN to see guest responses.</p>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <div className="a-field">
          <label htmlFor={`${id}-pin`}>PIN</label>
          <input
            ref={inputRef}
            id={`${id}-pin`}
            className="a-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={onChange}
            disabled={busy}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          {error && (
            <p className="a-error" id={`${id}-err`} role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="a-btn a-btn--primary a-btn--block" type="submit" aria-disabled={busy || undefined}>
          {busy ? 'Opening…' : 'Open dashboard'}
        </button>
      </form>
    </main>
  );
}

/* ---------------- Dashboard ---------------- */
function SummaryCard({ label, value, hint, tone }) {
  return (
    <div className={`stat stat--${tone}`}>
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {hint && <dd className="stat__hint">{hint}</dd>}
    </div>
  );
}

const Badge = ({ attendance }) =>
  attendance === 'yes' ? <span className="badge badge--yes">Yes</span> : <span className="badge badge--no">No</span>;

const wasUpdated = (r) => r.updatedAt && Math.abs(new Date(r.updatedAt) - new Date(r.submittedAt)) > 1000;

function GuestList({ r }) {
  if (r.attendance === 'no') return <p className="muted">Declined, no attending guests.</p>;
  if (!r.guestNames?.length)
    return (
      <p className="muted">
        Guest names not provided ({r.guests} {r.guests === 1 ? 'guest' : 'guests'}).
      </p>
    );
  return (
    <ol className="guest-list">
      {r.guestNames.map((g, i) => (
        <li key={i}>{g}</li>
      ))}
    </ol>
  );
}

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="a-check" checked={checked} onChange={onChange} aria-label={label} />;
}

function Dashboard({ onSignedOut }) {
  const id = useId();
  const [state, setState] = useState({ status: 'loading', responses: [], fetchedAt: null, error: '' });
  const [q, setQ] = useState('');
  const [attendance, setAttendance] = useState('all');
  const [sort, setSort] = useState('newest');
  const [exportState, setExportState] = useState({ busy: false, error: '' });
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { records }
  const [confirmState, setConfirmState] = useState({ busy: false, error: '' });
  const [toast, setToast] = useState(null);
  const loadingRef = useRef(false);

  const handleAuthError = useCallback(
    (err) => {
      if (err instanceof ApiError && err.status === 401) {
        onSignedOut(err.message);
        return true;
      }
      return false;
    },
    [onSignedOut],
  );

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setState((s) => ({ ...s, status: s.fetchedAt ? 'refreshing' : 'loading', error: '' }));
    try {
      const data = await fetchResponses();
      setState({ status: 'ready', responses: data.responses, fetchedAt: data.fetchedAt, error: '' });
    } catch (err) {
      if (!handleAuthError(err)) setState((s) => ({ ...s, status: 'error', error: err.message }));
    } finally {
      loadingRef.current = false;
    }
  }, [handleAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const totals = useMemo(() => summarise(state.responses), [state.responses]);
  const visible = useMemo(() => filterResponses(state.responses, { q, attendance, sort }), [state.responses, q, attendance, sort]);
  const filtered = q.trim() !== '' || attendance !== 'all';

  // Selection only ever covers the rows currently displayed.
  useEffect(() => {
    const shown = new Set(visible.map((r) => r.id));
    setSelected((sel) => {
      const next = new Set([...sel].filter((x) => shown.has(x)));
      return next.size === sel.size ? sel : next;
    });
  }, [visible]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)));
  const toggleOne = (rid) =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  const toggleExpanded = (rid) =>
    setExpanded((ex) => {
      const next = new Set(ex);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });

  async function exportCsv() {
    if (exportState.busy) return;
    setExportState({ busy: true, error: '' });
    try {
      await downloadCsv({ q, attendance, sort });
      setExportState({ busy: false, error: '' });
    } catch (err) {
      if (!handleAuthError(err)) setExportState({ busy: false, error: err.message });
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      onSignedOut('You have signed out.');
    }
  }

  const clearFilters = () => {
    setQ('');
    setAttendance('all');
  };

  const onSaved = async (response, err) => {
    if (err) return handleAuthError(err);
    setEditing(null);
    setToast({ type: 'success', text: `Changes to ${response.name}’s RSVP were saved.` });
    await load(); // search, filters and sorting are kept
  };

  const askDelete = (records) => {
    setConfirmState({ busy: false, error: '' });
    setConfirm({ records });
  };

  async function confirmDelete() {
    if (!confirm || confirmState.busy) return;
    setConfirmState({ busy: true, error: '' });
    try {
      const ids = confirm.records.map((r) => r.id);
      const out = ids.length === 1 ? await deleteRsvp(ids[0]) : await deleteRsvps(ids);
      setConfirm(null);
      setEditing(null);
      setSelected((sel) => new Set([...sel].filter((x) => !ids.includes(x))));
      setToast({
        type: 'success',
        text: `Deleted ${out.deleted === 1 ? '1 RSVP' : `${out.deleted} RSVPs`} (${out.attendingGuests === 1 ? '1 attending guest' : `${out.attendingGuests} attending guests`}).`,
      });
      await load();
    } catch (err) {
      if (handleAuthError(err)) return;
      setConfirmState({ busy: false, error: err.message });
      if (err.status === 404) load();
    }
  }

  const firstLoad = state.status === 'loading' && !state.fetchedAt;
  const selectedRecords = visible.filter((r) => selected.has(r.id));

  const Actions = ({ r }) => (
    <div className="row-actions">
      <button type="button" className="a-btn a-btn--ghost a-btn--small" onClick={() => setEditing(r)} aria-label={`View or edit ${r.name}’s RSVP`}>
        View / Edit
      </button>
      <button type="button" className="a-btn a-btn--danger-ghost a-btn--small" onClick={() => askDelete([r])} aria-label={`Delete ${r.name}’s RSVP`}>
        Delete
      </button>
    </div>
  );

  return (
    <div className="dash">
      <header className="dash__header">
        <div className="dash__brand">
          <img src={ASSETS.logoTitle.src} alt="" width={ASSETS.logoTitle.width} height={ASSETS.logoTitle.height} />
          <div>
            <h1 className="dash__title">RSVP dashboard</h1>
            <p className="dash__event">
              {EVENT.dateLabel} · {EVENT.timeLabel}
            </p>
          </div>
        </div>
        <button type="button" className="a-btn a-btn--ghost" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="dash__main">
        <section aria-labelledby={`${id}-summary`}>
          <h2 id={`${id}-summary`} className="sr-only">
            Summary
          </h2>
          <dl className="stats" aria-busy={firstLoad || undefined}>
            <SummaryCard tone="total" label="Total responses" value={firstLoad ? '–' : totals.total} />
            <SummaryCard tone="yes" label="Attending parties" value={firstLoad ? '–' : totals.attendingParties} />
            <SummaryCard tone="guests" label="Attending guests" value={firstLoad ? '–' : totals.attendingGuests} hint="Includes each person who replied" />
            <SummaryCard tone="no" label="Declined" value={firstLoad ? '–' : totals.declined} />
          </dl>
        </section>

        <section className="responses" aria-labelledby={`${id}-responses`}>
          <div className="responses__head">
            <h2 id={`${id}-responses`} className="responses__title">
              Responses
            </h2>
            <p className="responses__refreshed" aria-live="polite">
              {state.status === 'refreshing'
                ? 'Refreshing…'
                : state.fetchedAt
                  ? `Last refreshed ${refreshedFmt.format(new Date(state.fetchedAt))} (Maldives time)`
                  : ''}
            </p>
          </div>

          <div className="toolbar">
            <div className="a-field toolbar__search">
              <label htmlFor={`${id}-q`}>Search by name, guest or phone</label>
              <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Aisha or 777" autoComplete="off" />
            </div>
            <fieldset className="segmented">
              <legend>Attendance</legend>
              <div className="segmented__options">
                {[
                  ['all', 'All'],
                  ['yes', 'Attending'],
                  ['no', 'Declined'],
                ].map(([value, label]) => (
                  <label key={value} className={attendance === value ? 'is-on' : ''}>
                    <input type="radio" name={`${id}-att`} value={value} checked={attendance === value} onChange={() => setAttendance(value)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="a-field toolbar__sort">
              <label htmlFor={`${id}-sort`}>Sort</label>
              <select id={`${id}-sort`} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <div className="toolbar__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={load} disabled={state.status === 'refreshing' || firstLoad}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
                Refresh
              </button>
              <button type="button" className="a-btn a-btn--primary" onClick={exportCsv} disabled={exportState.busy || visible.length === 0}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
                </svg>
                {exportState.busy ? 'Preparing…' : filtered ? 'Export filtered CSV' : 'Export CSV'}
              </button>
            </div>
          </div>
          {exportState.error && (
            <p className="a-error" role="alert">
              {exportState.error}
            </p>
          )}

          {state.status === 'error' && (
            <div className="state state--error" role="alert">
              <p>{state.error}</p>
              <button type="button" className="a-btn a-btn--ghost" onClick={load}>
                Try again
              </button>
            </div>
          )}

          {firstLoad && (
            <div className="state" role="status">
              <span className="a-spinner" aria-hidden="true" /> Loading responses…
            </div>
          )}

          {!firstLoad && state.status !== 'error' && state.responses.length === 0 && (
            <div className="state state--empty">
              <p className="state__title">No RSVPs yet</p>
              <p>Responses will appear here as guests reply to the invitation.</p>
            </div>
          )}

          {state.responses.length > 0 && (
            <>
              <div className="list-bar">
                <label className="list-bar__all">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} label="Select all displayed RSVPs" />
                  <span>Select all</span>
                </label>
                <p className="responses__count" aria-live="polite">
                  {selected.size > 0 ? `${selected.size} selected · ` : ''}Showing {visible.length} of {state.responses.length}{' '}
                  {state.responses.length === 1 ? 'response' : 'responses'}
                </p>
                {selected.size > 0 && (
                  <div className="list-bar__actions">
                    <button type="button" className="a-btn a-btn--ghost a-btn--small" onClick={() => setSelected(new Set())}>
                      Clear selection
                    </button>
                    <button type="button" className="a-btn a-btn--danger a-btn--small" onClick={() => askDelete(selectedRecords)}>
                      Delete selected ({selected.size})
                    </button>
                  </div>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="state state--empty">
                  <p className="state__title">No responses match</p>
                  <p>Try a different name or number, or clear the filters.</p>
                  <button type="button" className="a-btn a-btn--ghost" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table">
                      <caption className="sr-only">Guest responses, {sort === 'newest' ? 'newest first' : 'oldest first'}</caption>
                      <thead>
                        <tr>
                          <th scope="col" className="col-check">
                            <span className="sr-only">Select</span>
                          </th>
                          <th scope="col">Guest name</th>
                          <th scope="col">Phone number</th>
                          <th scope="col">Attendance</th>
                          <th scope="col" className="num">
                            Guests
                          </th>
                          <th scope="col">Submitted (Maldives time)</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const open = expanded.has(r.id);
                          return (
                            <Fragment key={r.id}>
                              <tr className={selected.has(r.id) ? 'is-selected' : ''}>
                                <td className="col-check">
                                  <Checkbox checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} label={`Select ${r.name}’s RSVP`} />
                                </td>
                                <th scope="row">
                                  <button
                                    type="button"
                                    className="expander"
                                    aria-expanded={open}
                                    aria-controls={`${id}-d-${r.id}`}
                                    onClick={() => toggleExpanded(r.id)}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                      <path d="M9 6l6 6-6 6" />
                                    </svg>
                                    <span>{r.name}</span>
                                    <span className="sr-only">{open ? ', hide guests' : ', show guests'}</span>
                                  </button>
                                </th>
                                <td>{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : <span className="muted">—</span>}</td>
                                <td>
                                  <Badge attendance={r.attendance} />
                                </td>
                                <td className="num">{r.guests}</td>
                                <td>
                                  <time dateTime={r.submittedAt}>{formatWhen(r.submittedAt)}</time>
                                  {wasUpdated(r) && <span className="updated-tag">Updated</span>}
                                </td>
                                <td>
                                  <Actions r={r} />
                                </td>
                              </tr>
                              {open && (
                                <tr className="details-row" id={`${id}-d-${r.id}`}>
                                  <td />
                                  <td colSpan={6}>
                                    <div className="details">
                                      <div>
                                        <p className="details__label">Guests</p>
                                        <GuestList r={r} />
                                      </div>
                                      {wasUpdated(r) && <p className="details__meta">Last updated {formatWhen(r.updatedAt)}</p>}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className="cards" aria-label="Guest responses">
                    {visible.map((r) => {
                      const open = expanded.has(r.id);
                      return (
                        <li key={r.id} className={`rcard${selected.has(r.id) ? ' is-selected' : ''}`}>
                          <div className="rcard__top">
                            <Checkbox checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} label={`Select ${r.name}’s RSVP`} />
                            <h3 className="rcard__name">{r.name}</h3>
                            <Badge attendance={r.attendance} />
                          </div>
                          <dl className="rcard__grid">
                            <div>
                              <dt>Phone</dt>
                              <dd>{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</dd>
                            </div>
                            <div>
                              <dt>Guests</dt>
                              <dd>{r.guests}</dd>
                            </div>
                            <div className="rcard__wide">
                              <dt>Submitted</dt>
                              <dd>
                                <time dateTime={r.submittedAt}>{formatWhen(r.submittedAt)}</time>
                                {wasUpdated(r) && <span className="updated-tag">Updated</span>}
                              </dd>
                            </div>
                          </dl>
                          <button type="button" className="expander expander--card" aria-expanded={open} onClick={() => toggleExpanded(r.id)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                            {open ? 'Hide guest names' : 'Show guest names'}
                          </button>
                          {open && (
                            <div className="details details--card">
                              <GuestList r={r} />
                              {wasUpdated(r) && <p className="details__meta">Last updated {formatWhen(r.updatedAt)}</p>}
                            </div>
                          )}
                          <Actions r={r} />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </main>

      {editing && (
        <EditRsvp
          key={editing.id}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onRequestDelete={(r) => askDelete([r])}
        />
      )}
      <ConfirmDelete request={confirm} busy={confirmState.busy} error={confirmState.error} onConfirm={confirmDelete} onCancel={() => setConfirm(null)} />

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className={`toast toast--${toast.type}`}>{toast.text}</div>}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function AdminApp() {
  const [phase, setPhase] = useState('checking'); // checking | login | dashboard | error
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    setPhase('checking');
    try {
      setPhase((await checkSession()) ? 'dashboard' : 'login');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const signedOut = useCallback((message) => {
    setNotice(message || '');
    setPhase('login');
  }, []);

  if (phase === 'checking')
    return (
      <main className="login">
        <div className="state" role="status">
          <span className="a-spinner" aria-hidden="true" /> Opening the dashboard…
        </div>
      </main>
    );
  if (phase === 'error')
    return (
      <main className="login">
        <div className="state state--error" role="alert">
          <p>{error}</p>
          <button type="button" className="a-btn a-btn--ghost" onClick={check}>
            Try again
          </button>
        </div>
      </main>
    );
  if (phase === 'login')
    return (
      <Login
        notice={notice}
        onSignedIn={() => {
          setNotice('');
          setPhase('dashboard');
        }}
      />
    );
  return <Dashboard onSignedOut={signedOut} />;
}
