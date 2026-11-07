import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COPY, RSVP_CONFIG } from '../config/event.js';
import { parseGuestCount, validateRsvp } from '../../shared/rsvpValidation.js';
import { createSubmissionId, isPreviewMode, RsvpSubmissionError, submitRsvp } from '../services/rsvpService.js';
import { Star } from './Ornaments.jsx';

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="M8 4.2v4.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="8" cy="11.6" r="1.1" fill="#fff" />
  </svg>
);

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      <ErrorIcon />
      <span>{message}</span>
    </p>
  );
}

function Field({ id, label, error, help, inputRef, ...input }) {
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && (
        <p className="field__help" id={`${id}-help`}>
          {help}
        </p>
      )}
      <input id={id} ref={inputRef} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} required {...input} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

const reveal = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { height: { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }, opacity: { duration: 0.35, delay: 0.1 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.35, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.2 } } },
};

const DUPLICATE_TITLE = 'Phone number already registered';
const DUPLICATE_MESSAGE =
  'This phone number has already been registered for this event. Please contact the event organiser if you need to update your RSVP.';

/** Accessible modal (native <dialog>: focus is trapped, Esc closes, focus returns afterwards). */
function DuplicatePhoneDialog({ open, onClose }) {
  const ref = useRef(null);
  const uid = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-message`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 className="modal__title" id={`${uid}-title`}>
        {DUPLICATE_TITLE}
      </h2>
      <p className="modal__message" id={`${uid}-message`}>
        {DUPLICATE_MESSAGE}
      </p>
      <button type="button" className="btn btn--primary btn--block" onClick={onClose} autoFocus>
        OK
      </button>
    </dialog>
  );
}

const FIELD_ORDER = ['attendance', 'name', 'phone', 'guests'];

/**
 * RSVP form.
 * - Yes → name, phone, number of guests and one required full name per guest
 *   (Guest 1 is "Your Name", kept in sync both ways).
 * - No  → name and phone only; guest fields are hidden and not validated.
 * Hidden fields are unmounted, so they never block submission. Success is shown
 * only after the server confirms the response was saved.
 */
export default function RsvpForm() {
  const uid = useId();
  const [attendance, setAttendance] = useState(null);
  const [values, setValues] = useState({ name: '', phone: '', guests: '1' });
  // guestNames[0] is unused: Guest 1 is always values.name. Extra entries are kept when
  // the count goes down, so names come back if it goes up again.
  const [guestNames, setGuestNames] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState('');
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [result, setResult] = useState(null);
  const submissionId = useRef(createSubmissionId()); // one id per form → retries never duplicate
  const inflight = useRef(false);
  const lastValidCount = useRef(1);
  const refs = { attendance: useRef(null), name: useRef(null), phone: useRef(null), guests: useRef(null) };
  const guestRefs = useRef([]);
  const successRef = useRef(null);
  const honeypot = useRef(null);

  useEffect(() => {
    if (status === 'success') successRef.current?.focus();
  }, [status]);

  const parsed = parseGuestCount(values.guests);
  if (parsed !== null && parsed <= RSVP_CONFIG.maxGuests) lastValidCount.current = parsed;
  const guestCount = lastValidCount.current;

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const set = (key) => (event) => {
    const value = event.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    clearError(key);
    if (key === 'name' && errors.guestNames?.[0]) {
      setErrors((e) => ({ ...e, guestNames: { ...e.guestNames, 0: undefined } }));
    }
  };

  const setGuestName = (index) => (event) => {
    const value = event.target.value;
    if (index === 0) {
      setValues((v) => ({ ...v, name: value })); // Guest 1 ⇄ Your Name
      clearError('name');
    } else {
      setGuestNames((list) => {
        const next = [...list];
        next[index] = value;
        return next;
      });
    }
    if (errors.guestNames?.[index]) setErrors((e) => ({ ...e, guestNames: { ...e.guestNames, [index]: undefined } }));
  };

  const choose = (value) => {
    setAttendance(value);
    // Drop errors for fields that are now hidden.
    setErrors((e) => (value === 'no' ? { name: e.name, phone: e.phone } : { name: e.name, phone: e.phone }));
    if (status === 'error') setStatus('idle');
  };

  function focusFirstError(errs) {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first === 'attendance') return refs.attendance.current?.querySelector('input')?.focus();
    if (first) return refs[first]?.current?.focus();
    const guestIndex = Object.keys(errs.guestNames || {}).map(Number).sort((a, b) => a - b)[0];
    if (guestIndex !== undefined) guestRefs.current[guestIndex]?.focus();
  }

  async function send() {
    if (inflight.current) return; // repeated taps while sending are ignored
    const check = validateRsvp({ attendance, ...values, guestNames: [values.name, ...guestNames.slice(1)] }, { maxGuests: RSVP_CONFIG.maxGuests });
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstError(check.errors);
      return;
    }

    inflight.current = true;
    setErrors({});
    setSubmitError('');
    setStatus('submitting');
    try {
      const saved = await submitRsvp({ ...check.value, submissionId: submissionId.current, website: honeypot.current?.value || '' });
      setResult({ ...saved, attendance: check.value.attendance });
      setStatus('success');
    } catch (error) {
      const err = error instanceof RsvpSubmissionError ? error : new RsvpSubmissionError('Something went wrong. Please try again.');
      if (err.fieldErrors) setErrors(err.fieldErrors);
      if (err.kind === 'duplicate-phone') {
        setStatus('idle');
        setDuplicateOpen(true);
      } else {
        setSubmitError(err.message);
        setStatus('error');
      }
    } finally {
      inflight.current = false;
    }
  }

  const closeDuplicate = () => {
    setDuplicateOpen(false);
    // Everything typed is kept; move focus to the phone number so it can be checked.
    requestAnimationFrame(() => refs.phone.current?.focus());
  };

  const onSubmit = (event) => {
    event.preventDefault();
    send();
  };

  if (status === 'success') {
    const message = result.preview
      ? 'Preview only: this response was not sent to the family, because RSVP collection isn’t connected yet.'
      : result.attendance === 'yes'
        ? COPY.rsvp.successYes
        : COPY.rsvp.successNo;
    return (
      <motion.div className="rsvp-success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        {!result.preview && (
          <span className="rsvp-success__burst" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <Star key={i} style={{ '--i': i, '--a': `${i * 36 + (i % 2) * 12}deg` }} />
            ))}
          </span>
        )}
        <p className={result.preview ? 'alert alert--preview' : 'rsvp-success__message'} ref={successRef} tabIndex={-1} role="status">
          {message}
        </p>
      </motion.div>
    );
  }

  const busy = status === 'submitting';
  const legendId = `${uid}-legend`;

  return (
    <form className="rsvp-form" onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
      <fieldset
        className="choice-group"
        ref={refs.attendance}
        aria-invalid={errors.attendance ? 'true' : undefined}
        aria-describedby={errors.attendance ? `${uid}-attendance-error` : undefined}
      >
        <legend className="sr-only" id={legendId}>
          {COPY.rsvp.heading}
        </legend>
        <div className="choice-group__options">
          {[
            ['yes', COPY.rsvp.yes],
            ['no', COPY.rsvp.no],
          ].map(([value, label]) => (
            <label key={value} className={`choice${attendance === value ? ' is-checked' : ''}`}>
              <input type="radio" name="attendance" value={value} checked={attendance === value} onChange={() => choose(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError id={`${uid}-attendance-error`} message={errors.attendance} />
      </fieldset>

      <AnimatePresence initial={false}>
        {attendance && (
          <motion.div className="fields" key="fields" {...reveal}>
            <div className="fields__inner">
              <Field
                id={`${uid}-name`}
                label="Your Name"
                inputRef={refs.name}
                type="text"
                name="name"
                autoComplete="name"
                autoCapitalize="words"
                maxLength={80}
                value={values.name}
                onChange={set('name')}
                error={errors.name}
              />
              <Field
                id={`${uid}-phone`}
                label="Your Phone"
                help="Maldivian numbers can be entered as 7 digits. Outside the Maldives, include the country code, e.g. +971 50 123 4567."
                inputRef={refs.phone}
                type="tel"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                value={values.phone}
                onChange={set('phone')}
                error={errors.phone}
              />
              <AnimatePresence initial={false}>
                {attendance === 'yes' && (
                  <motion.div key="yes-fields" className="fields" {...reveal}>
                    <div className="fields__inner" style={{ paddingTop: 0 }}>
                      <Field
                        id={`${uid}-guests`}
                        label="Number of Guests"
                        help={COPY.rsvp.guestsHelp}
                        inputRef={refs.guests}
                        type="number"
                        name="guests"
                        inputMode="numeric"
                        min={1}
                        max={RSVP_CONFIG.maxGuests}
                        step={1}
                        value={values.guests}
                        onChange={set('guests')}
                        error={errors.guests}
                      />
                      <fieldset className="guest-names" aria-describedby={`${uid}-guest-names-help`}>
                        <legend className="guest-names__legend">Guest names</legend>
                        <p className="field__help" id={`${uid}-guest-names-help`}>
                          {guestCount === 1
                            ? 'Guest 1 is you.'
                            : `Please enter the full name of each of the ${guestCount} guests. Guest 1 is you.`}
                        </p>
                        <div className="guest-names__list">
                          <AnimatePresence initial={false}>
                            {Array.from({ length: guestCount }, (_, i) => (
                              <motion.div key={i} className="fields" {...reveal}>
                                <Field
                                  id={`${uid}-guest-${i + 1}`}
                                  label={`Guest ${i + 1} – Full Name`}
                                  inputRef={(el) => {
                                    guestRefs.current[i] = el;
                                  }}
                                  type="text"
                                  name={`guest-${i + 1}`}
                                  data-guest-index={i}
                                  autoComplete={i === 0 ? 'name' : 'off'}
                                  autoCapitalize="words"
                                  maxLength={80}
                                  value={i === 0 ? values.name : guestNames[i] || ''}
                                  onChange={setGuestName(i)}
                                  error={errors.guestNames?.[i]}
                                />
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </fieldset>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="honeypot" aria-hidden="true">
        <label>
          Leave this empty
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div aria-live="assertive">
        {status === 'error' && (
          <div className="alert alert--error" role="alert">
            <p>{submitError}</p>
            <button type="button" className="btn btn--ghost" onClick={send}>
              Try again
            </button>
          </div>
        )}
      </div>

      <button type="submit" className="btn btn--primary btn--block rsvp-form__submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Sending…
          </>
        ) : (
          COPY.rsvp.submit
        )}
      </button>
      {isPreviewMode && (
        <p className="alert alert--preview" style={{ marginTop: 12 }}>
          Preview mode: responses aren’t sent anywhere yet.
        </p>
      )}

      <DuplicatePhoneDialog open={duplicateOpen} onClose={closeDuplicate} />
    </form>
  );
}
