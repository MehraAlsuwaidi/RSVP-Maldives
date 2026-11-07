import { useEffect, useId, useRef, useState } from 'react';
import { validateAdminEdit } from '../../shared/rsvpValidation.js';
import { updateRsvp } from './api.js';

/** Native <dialog> wrapper: focus trap, Esc to close (unless busy), focus returns on close. */
export function Modal({ open, onClose, busy, labelledBy, describedBy, role = 'dialog', className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`a-modal ${className}`}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}

/** Confirmation before deleting one or more RSVPs. */
export function ConfirmDelete({ request, busy, error, onConfirm, onCancel }) {
  const uid = useId();
  const count = request?.records.length || 0;
  const guests = request?.records.reduce((n, r) => n + (r.attendance === 'yes' ? r.guests : 0), 0) || 0;
  const title = count === 1 ? `Delete the RSVP from ${request.records[0].name}?` : `Delete ${count} RSVPs?`;
  return (
    <Modal open={!!request} onClose={onCancel} busy={busy} role="alertdialog" labelledBy={`${uid}-t`} describedBy={`${uid}-d`}>
      <h2 className="a-modal__title" id={`${uid}-t`}>
        {title}
      </h2>
      <p className="a-modal__text" id={`${uid}-d`}>
        This will permanently remove <strong>{count === 1 ? '1 RSVP record' : `${count} RSVP records`}</strong> and{' '}
        <strong>{guests === 1 ? '1 attending guest' : `${guests} attending guests`}</strong>, including all guest names. This can’t be undone.
      </p>
      {error && (
        <p className="a-error" role="alert">
          {error}
        </p>
      )}
      <div className="a-modal__actions">
        <button type="button" className="a-btn a-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="a-btn a-btn--danger" onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? 'Deleting…' : count === 1 ? 'Delete RSVP' : `Delete ${count} RSVPs`}
        </button>
      </div>
    </Modal>
  );
}

function initialDraft(record) {
  const legacy = record.attendance === 'yes' && record.guestNames.length === 0;
  return {
    name: record.name,
    phone: record.phone ?? '',
    attendance: record.attendance,
    // Legacy records keep their stored count with blank names (nothing is invented).
    guestNames: record.attendance === 'yes' ? (legacy ? Array.from({ length: record.guests }, () => '') : [...record.guestNames]) : [],
  };
}

/** View / edit one RSVP. Cancel discards every unsaved change. */
export function EditRsvp({ record, onClose, onSaved, onRequestDelete, maxGuests = 20 }) {
  const uid = useId();
  const [draft, setDraft] = useState(() => initialDraft(record));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastGuestNotice, setLastGuestNotice] = useState(false);
  const stash = useRef([]); // names removed by lowering the count, restored if raised again
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const guestRefs = useRef([]);

  const legacy = record.attendance === 'yes' && record.guestNames.length === 0;
  const attending = draft.attendance === 'yes';
  const count = draft.guestNames.length;

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

  const setCount = (raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > maxGuests) return;
    if (n === 0) return setLastGuestNotice(true);
    setLastGuestNotice(false);
    setDraft((d) => {
      const list = [...d.guestNames];
      if (n < list.length) stash.current = [...list.slice(n), ...stash.current];
      while (list.length < n) list.push(stash.current.shift() ?? '');
      return { ...d, guestNames: list.slice(0, n) };
    });
    clear('guests');
  };

  const addGuest = () => {
    if (count >= maxGuests) return;
    setLastGuestNotice(false);
    update({ guestNames: [...draft.guestNames, ''] });
    requestAnimationFrame(() => guestRefs.current[count]?.focus());
  };

  const removeGuest = (index) => {
    if (count <= 1) return setLastGuestNotice(true); // last attendee: choose Declined or delete
    update({ guestNames: draft.guestNames.filter((_, i) => i !== index) });
    setErrors((e) => ({ ...e, guestNames: undefined, guests: undefined }));
    requestAnimationFrame(() => guestRefs.current[Math.max(0, index - 1)]?.focus());
  };

  const setGuest = (index, value) => {
    const list = [...draft.guestNames];
    list[index] = value;
    update({ guestNames: list });
    if (errors.guestNames?.[index]) setErrors((e) => ({ ...e, guestNames: { ...e.guestNames, [index]: undefined } }));
  };

  const chooseAttendance = (value) => {
    setLastGuestNotice(false);
    if (value === 'yes' && draft.guestNames.length === 0) update({ attendance: value, guestNames: [draft.name] });
    else update({ attendance: value });
    setErrors({});
  };

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const payload = {
      name: draft.name,
      phone: draft.phone,
      attendance: draft.attendance,
      guests: attending ? String(count) : '0',
      guestNames: attending ? draft.guestNames : [],
    };
    const check = validateAdminEdit(payload, record, { maxGuests });
    if (!check.ok) {
      setErrors(check.errors);
      setFormError('Please check the highlighted details.');
      if (check.errors.name) nameRef.current?.focus();
      else if (check.errors.phone) phoneRef.current?.focus();
      else {
        const i = Object.keys(check.errors.guestNames || {}).map(Number).sort((a, b) => a - b)[0];
        if (i !== undefined) guestRefs.current[i]?.focus();
      }
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const { response } = await updateRsvp(record.id, payload);
      onSaved(response);
    } catch (err) {
      if (err.status === 401) return onSaved(null, err);
      if (err.fieldErrors) setErrors(err.fieldErrors);
      if (err.status === 409) phoneRef.current?.focus();
      setFormError(err.message);
      setBusy(false);
    }
  }

  const fieldProps = (key) => ({
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-err` : undefined,
  });

  return (
    <Modal open onClose={onClose} busy={busy} labelledBy={`${uid}-title`} className="a-modal--wide">
      <form onSubmit={save} noValidate>
        <div className="a-modal__head">
          <h2 className="a-modal__title" id={`${uid}-title`}>
            Edit RSVP
          </h2>
          <p className="a-modal__meta">
            Submitted {new Date(record.submittedAt).toLocaleString('en-GB', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'short' })}
            {record.updatedAt && Math.abs(new Date(record.updatedAt) - new Date(record.submittedAt)) > 1000 &&
              ` · Last updated ${new Date(record.updatedAt).toLocaleString('en-GB', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'short' })}`}
          </p>
        </div>

        <div className="a-modal__body">
          <h3 className="a-section">Main contact</h3>
          <div className="a-field">
            <label htmlFor={`${uid}-name`}>Main contact name</label>
            <input ref={nameRef} id={`${uid}-name`} value={draft.name} maxLength={80} onChange={(e) => (update({ name: e.target.value }), clear('name'))} {...fieldProps('name')} />
            {errors.name && <p className="a-error" id={`${uid}-name-err`}>{errors.name}</p>}
          </div>
          <div className="a-field">
            <label htmlFor={`${uid}-phone`}>Phone number</label>
            <input ref={phoneRef} id={`${uid}-phone`} type="tel" inputMode="tel" value={draft.phone} maxLength={24} onChange={(e) => (update({ phone: e.target.value }), clear('phone'))} {...fieldProps('phone')} />
            {errors.phone && <p className="a-error" id={`${uid}-phone-err`}>{errors.phone}</p>}
          </div>

          <fieldset className="segmented">
            <legend>Attendance status</legend>
            <div className="segmented__options">
              {[
                ['yes', 'Attending'],
                ['no', 'Declined'],
              ].map(([value, label]) => (
                <label key={value} className={draft.attendance === value ? 'is-on' : ''}>
                  <input type="radio" name={`${uid}-att`} value={value} checked={draft.attendance === value} onChange={() => chooseAttendance(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {attending ? (
            <>
              <h3 className="a-section">Attending guests</h3>
              <div className="a-field a-field--count">
                <label htmlFor={`${uid}-count`}>Number of guests</label>
                <input id={`${uid}-count`} type="number" min={1} max={maxGuests} step={1} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} {...fieldProps('guests')} />
                {errors.guests && <p className="a-error" id={`${uid}-guests-err`}>{errors.guests}</p>}
              </div>
              {legacy && (
                <p className="notice">
                  Guest names not provided for this RSVP. You can add them now, or leave every name blank to keep the {record.guests}{' '}
                  {record.guests === 1 ? 'guest' : 'guests'} without names.
                </p>
              )}
              <ol className="guest-edit">
                {draft.guestNames.map((g, i) => (
                  <li key={i} className="guest-edit__row">
                    <div className="a-field">
                      <label htmlFor={`${uid}-g${i}`}>Guest {i + 1} – Full Name</label>
                      <div className="guest-edit__line">
                        <input
                          ref={(el) => {
                            guestRefs.current[i] = el;
                          }}
                          id={`${uid}-g${i}`}
                          value={g}
                          maxLength={80}
                          placeholder={legacy ? 'Not provided' : ''}
                          onChange={(e) => setGuest(i, e.target.value)}
                          aria-invalid={errors.guestNames?.[i] ? 'true' : undefined}
                          aria-describedby={errors.guestNames?.[i] ? `${uid}-g${i}-err` : undefined}
                        />
                        <button type="button" className="a-btn a-btn--ghost a-btn--small" onClick={() => removeGuest(i)} aria-label={`Remove guest ${i + 1}${g ? `, ${g}` : ''}`}>
                          Remove
                        </button>
                      </div>
                      {errors.guestNames?.[i] && <p className="a-error" id={`${uid}-g${i}-err`}>{errors.guestNames[i]}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              {lastGuestNotice && (
                <div className="notice notice--warn" role="alert">
                  <p>An attending RSVP needs at least one guest. To remove the last guest, change this RSVP to Declined or delete it.</p>
                  <div className="a-modal__actions a-modal__actions--start">
                    <button type="button" className="a-btn a-btn--ghost a-btn--small" onClick={() => chooseAttendance('no')}>
                      Change to Declined
                    </button>
                    <button type="button" className="a-btn a-btn--danger a-btn--small" onClick={() => onRequestDelete(record)}>
                      Delete RSVP
                    </button>
                  </div>
                </div>
              )}
              <button type="button" className="a-btn a-btn--ghost" onClick={addGuest} disabled={count >= maxGuests}>
                + Add guest
              </button>
            </>
          ) : (
            <p className="notice">Declined RSVPs have no attending guests. Saving stores 0 guests.</p>
          )}
        </div>

        {formError && (
          <p className="a-error a-modal__error" role="alert">
            {formError}
          </p>
        )}
        <div className="a-modal__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
