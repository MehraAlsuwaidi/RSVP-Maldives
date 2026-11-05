/**
 * RSVP validation shared by the invitation (instant feedback) and the server
 * (the authority). Keep this file dependency-free so both can import it.
 */

export const DEFAULT_MAX_GUESTS = 20;

const PHONE_ALLOWED = /^[+\d\s().\-–]+$/;

/** Turns "+960 777-1234" into "+9607771234". Returns null when it isn't a plausible number. */
export function normalisePhone(raw) {
  const text = String(raw ?? '').trim();
  if (!text || !PHONE_ALLOWED.test(text)) return null;
  const hasPlus = text.startsWith('+') || text.startsWith('00');
  let digits = text.replace(/\D/g, '');
  if (text.startsWith('00')) digits = digits.slice(2);
  // E.164 allows up to 15 digits; local Maldivian numbers have 7.
  if (digits.length < 7 || digits.length > 15) return null;
  return (hasPlus ? '+' : '') + digits;
}

/**
 * @param {object} input  { attendance: 'yes'|'no', name?, phone?, guests? }
 * @returns {{ ok: boolean, value?: object, errors: Record<string,string> }}
 */
export function validateRsvp(input, { maxGuests = DEFAULT_MAX_GUESTS } = {}) {
  const errors = {};
  const data = input && typeof input === 'object' ? input : {};
  const attendance = data.attendance;

  if (attendance !== 'yes' && attendance !== 'no') {
    errors.attendance = 'Please choose whether you can come.';
    return { ok: false, errors };
  }

  const name = String(data.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 80) errors.name = 'Please keep your name under 80 characters.';

  // A "no" only needs a name so the family knows who declined.
  // Phone and guest count are ignored and the party is saved as 0 guests.
  if (attendance === 'no') {
    if (errors.name) return { ok: false, errors };
    return { ok: true, value: { attendance, name, phone: null, guests: 0 }, errors };
  }

  const phoneRaw = String(data.phone ?? '').trim();
  const phone = normalisePhone(phoneRaw);
  if (!phoneRaw) errors.phone = 'Please enter your phone number.';
  else if (!phone)
    errors.phone = 'Please enter a valid phone number, with the country code if outside the Maldives (e.g. +960 7XX XXXX).';

  const guestsRaw = String(data.guests ?? '').trim();
  const guests = Number(guestsRaw);
  if (!guestsRaw) errors.guests = 'Please enter the number of guests.';
  else if (!/^\d+$/.test(guestsRaw) || !Number.isInteger(guests) || guests < 1)
    errors.guests = 'Please enter a whole number, starting at 1.';
  else if (guests > maxGuests)
    errors.guests = `For more than ${maxGuests} guests, please contact the family directly.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { attendance, name, phone, guests }, errors };
}
