import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ASSETS, EVENT } from '../config/event.js';
import { filterResponses, summarise } from '../../shared/rsvpFilters.js';
import { ApiError, checkSession, downloadCsv, fetchResponses, login, logout } from './api.js';

const TZ = EVENT.timeZone;
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const refreshedFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const formatWhen = (iso) => {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
};

/* ---------------- Login ---------------- */
function Login({ notice, onSignedIn }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError('Please enter the owner password.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(password);
      setPassword('');
      onSignedIn();
    } catch (err) {
      setError(err.message);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <img className="login__logo" src={ASSETS.logoTitle.src} alt="Magical Birthday" width={ASSETS.logoTitle.width} height={ASSETS.logoTitle.height} />
        <h1 className="login__title">RSVP dashboard</h1>
        <p className="login__sub">For the event owner only. Sign in to see guest responses.</p>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <div className="a-field">
          <label htmlFor={`${id}-pw`}>Owner password</label>
          <div className="a-password">
            <input
              ref={inputRef}
              id={`${id}-pw`}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              required
            />
            <button type="button" className="a-password__toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && (
            <p className="a-error" id={`${id}-err`} role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="a-btn a-btn--primary a-btn--block" type="submit" aria-disabled={busy || undefined}>
          {busy ? 'Signing in…' : 'Sign in'}
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

function Dashboard({ onSignedOut }) {
  const id = useId();
  const [state, setState] = useState({ status: 'loading', responses: [], fetchedAt: null, error: '' });
  const [q, setQ] = useState('');
  const [attendance, setAttendance] = useState('all');
  const [sort, setSort] = useState('newest');
  const [exportState, setExportState] = useState({ busy: false, error: '' });
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

  const totals = useMemo(() => summarise(state.responses), [state.responses]);
  const visible = useMemo(() => filterResponses(state.responses, { q, attendance, sort }), [state.responses, q, attendance, sort]);
  const filtered = q.trim() !== '' || attendance !== 'all';

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

  const firstLoad = state.status === 'loading' && !state.fetchedAt;

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
              <label htmlFor={`${id}-q`}>Search by name or phone</label>
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
              <button type="button" className="a-btn a-btn--ghost" onClick={load} aria-disabled={state.status === 'refreshing' || firstLoad || undefined}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
                Refresh
              </button>
              <button
                type="button"
                className="a-btn a-btn--primary"
                onClick={exportCsv}
                aria-disabled={exportState.busy || visible.length === 0 || undefined}
                disabled={visible.length === 0}
              >
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
              <p className="responses__count" aria-live="polite">
                Showing {visible.length} of {state.responses.length} {state.responses.length === 1 ? 'response' : 'responses'}
              </p>

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
                          <th scope="col">Guest name</th>
                          <th scope="col">Phone number</th>
                          <th scope="col">Attendance</th>
                          <th scope="col" className="num">
                            Guests
                          </th>
                          <th scope="col">Submitted (Maldives time)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => (
                          <tr key={r.id}>
                            <th scope="row">{r.name}</th>
                            <td>{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : <span className="muted">—</span>}</td>
                            <td>
                              <Badge attendance={r.attendance} />
                            </td>
                            <td className="num">{r.guests}</td>
                            <td>
                              <time dateTime={r.submittedAt}>{formatWhen(r.submittedAt)}</time>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="cards" aria-label="Guest responses">
                    {visible.map((r) => (
                      <li key={r.id} className="rcard">
                        <div className="rcard__top">
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
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </main>
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
