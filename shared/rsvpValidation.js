/**
 * RSVP validation shared by the invitation (instant feedback) and the server
 * (the authority). Keep this file dependency-free so both can import it.
 */

export const DEFAULT_MAX_GUESTS = 20;
/** Identifies this celebration in the database (phone numbers are unique per event). */
export const EVENT_ID = 'magical-birthday-2026-11-21';

const COUNTRY_CODE = '960'; // Maldives
const LOCAL_LENGTH = 7; // Maldivian numbers have 7 digits
const PHONE_ALLOWED = /^[+\d\s().\-–—/]+$/;

/**
 * Normalises a phone number to E.164 so equivalent formats compare equal:
 *   "777 1234", "777-1234", "(777) 1234", "960 7771234", "+960 777 1234",
 *   "00960 7771234"  →  "+9607771234"
 * Local numbers without a country code are treated as Maldivian (+960).
 * Returns null when the number isn't valid or is ambiguous.
 */
export function normalisePhone(raw) {
  const text = String(raw ?? '').trim();
  if (!text || !PHONE_ALLOWED.test(text)) return null;
  const lead = text.replace(/^[\s(]+/, ''); // allow "(+960) …"
  if (lead.indexOf('+') > 0 || (lead.match(/\+/g) || []).length > 1) return null;

  let digits = text.replace(/\D/g, '');
  let international = lead.startsWith('+');
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (!international) {
    if (digits.length === LOCAL_LENGTH) digits = COUNTRY_CODE + digits;
    else if (digits.length === COUNTRY_CODE.length + LOCAL_LENGTH && digits.startsWith(COUNTRY_CODE)) {
      /* already includes 960 */
    } else return null; // other local formats are ambiguous: ask for the country code
  }

  if (digits.startsWith('0')) return null; // country codes never start with 0
  if (digits.startsWith(COUNTRY_CODE) && digits.length !== COUNTRY_CODE.length + LOCAL_LENGTH) return null;
  if (digits.length < 8 || digits.length > 15) return null; // E.164 limits
  return `+${digits}`;
}

const cleanName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Parses the guest count; returns an integer or null when it isn't a whole number ≥ 1. */
export function parseGuestCount(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * @param {object} input  { attendance: 'yes'|'no', name, phone, guests?, guestNames? }
 * @returns {{ ok: boolean, value?: object, errors: object }}
 *   errors.guestNames, when present, maps a guest index (0-based) to its message.
 */
export function validateRsvp(input, { maxGuests = DEFAULT_MAX_GUESTS } = {}) {
  const errors = {};
  const data = input && typeof input === 'object' ? input : {};
  const attendance = data.attendance;

  if (attendance !== 'yes' && attendance !== 'no') {
    errors.attendance = 'Please choose whether you can come.';
    return { ok: false, errors };
  }

  const name = cleanName(data.name);
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 80) errors.name = 'Please keep your name under 80 characters.';

  const phoneRaw = String(data.phone ?? '').trim();
  const phone = normalisePhone(phoneRaw);
  if (!phoneRaw) errors.phone = 'Please enter your phone number.';
  else if (!phone)
    errors.phone =
      'Please enter a valid phone number. Maldivian numbers have 7 digits; for other countries include the country code (e.g. +971 50 123 4567).';

  // "No" needs a name and phone only; guest count and names are not collected.
  if (attendance === 'no') {
    if (Object.keys(errors).length) return { ok: false, errors };
    return { ok: true, value: { attendance, name, phone, guests: 0, guestNames: [] }, errors };
  }

  const guestsRaw = String(data.guests ?? '').trim();
  const guests = parseGuestCount(guestsRaw);
  if (!guestsRaw) errors.guests = 'Please enter the number of guests.';
  else if (guests === null) errors.guests = 'Please enter a whole number, starting at 1.';
  else if (guests > maxGuests) errors.guests = `For more than ${maxGuests} guests, please contact the family directly.`;

  let guestNames = [];
  if (guests !== null && guests <= maxGuests) {
    const supplied = Array.isArray(data.guestNames) ? data.guestNames : [];
    // Guest 1 is always the person replying, kept in sync with "Your Name".
    guestNames = Array.from({ length: guests }, (_, i) => (i === 0 ? name : cleanName(supplied[i])));
    const nameErrors = {};
    guestNames.forEach((guestName, i) => {
      if (i === 0) return; // reported on "Your Name"
      if (!guestName) nameErrors[i] = `Please enter Guest ${i + 1}’s full name.`;
      else if (guestName.length > 80) nameErrors[i] = 'Please keep each name under 80 characters.';
    });
    if (errors.name) nameErrors[0] = 'Please enter Guest 1’s full name (this is your name).';
    if (Object.keys(nameErrors).length) errors.guestNames = nameErrors;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { attendance, name, phone, guests, guestNames }, errors };
}

export const DUPLICATE_PHONE_MESSAGE = 'This phone number has already been registered for this event.';

/**
 * Validates an admin edit of an existing RSVP.
 * The main contact (name/phone) is separate from the attendee list (guestNames),
 * so removing attendees never deletes the RSVP itself.
 *
 * @param {object} input     { name, phone, attendance, guests, guestNames }
 * @param {object} existing  stored record { phone, guestNames, guests }
 * Legacy records that were saved without individual names may stay that way:
 * an empty guestNames list is accepted when the stored record had none, and the
 * stored count is kept unless the admin changes it.
 */
export function validateAdminEdit(input, existing, { maxGuests = DEFAULT_MAX_GUESTS } = {}) {
  const errors = {};
  const data = input && typeof input === 'object' ? input : {};
  const attendance = data.attendance;
  if (attendance !== 'yes' && attendance !== 'no') errors.attendance = 'Please choose Attending or Declined.';

  const name = cleanName(data.name);
  if (!name) errors.name = 'Please enter the main contact’s name.';
  else if (name.length > 80) errors.name = 'Please keep the name under 80 characters.';

  // Phone: an unchanged stored value is always accepted (older records may predate
  // the current format rules); anything else is normalised and validated.
  const phoneRaw = String(data.phone ?? '').trim();
  let phone;
  if (existing && phoneRaw === String(existing.phone ?? '')) phone = existing.phone ?? null;
  else if (!phoneRaw) errors.phone = 'Please enter a phone number.';
  else {
    phone = normalisePhone(phoneRaw);
    if (!phone) errors.phone = 'Please enter a valid phone number (7 digits for the Maldives, or include the country code).';
  }

  let guests = 0;
  let guestNames = [];
  if (attendance === 'yes') {
    const list = Array.isArray(data.guestNames) ? data.guestNames.map(cleanName) : [];
    const legacyBlank = list.length === 0 || list.every((g) => !g);
    const storedHadNames = Array.isArray(existing?.guestNames) && existing.guestNames.length > 0;
    const count = parseGuestCount(data.guests);

    if (count === null) errors.guests = 'An attending party needs at least 1 guest. Change it to Declined, or delete the RSVP.';
    else if (count > maxGuests) errors.guests = `Please keep it to ${maxGuests} guests or fewer.`;
    else if (legacyBlank && !storedHadNames) {
      // Names not provided yet: keep them empty, nothing is invented.
      guests = count;
      guestNames = [];
    } else {
      if (list.length !== count) errors.guests = 'The number of guests must match the guest list.';
      const nameErrors = {};
      list.forEach((g, i) => {
        if (!g) nameErrors[i] = `Please enter Guest ${i + 1}’s full name.`;
        else if (g.length > 80) nameErrors[i] = 'Please keep each name under 80 characters.';
      });
      if (Object.keys(nameErrors).length) errors.guestNames = nameErrors;
      guests = count;
      guestNames = list;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { attendance, name, phone, guests, guestNames }, errors };
}
