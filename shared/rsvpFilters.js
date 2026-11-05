/** Search / filter / sort used by both the dashboard and the server-side CSV export. */

const digits = (s) => String(s ?? '').replace(/\D/g, '');

export function filterResponses(rows, { q = '', attendance = 'all', sort = 'newest' } = {}) {
  const query = String(q).trim().toLowerCase();
  const queryDigits = digits(query);
  const out = rows.filter((r) => {
    if (attendance === 'yes' || attendance === 'no') {
      if (r.attendance !== attendance) return false;
    }
    if (!query) return true;
    if (String(r.name ?? '').toLowerCase().includes(query)) return true;
    if (String(r.phone ?? '').toLowerCase().includes(query)) return true;
    return queryDigits.length >= 3 && digits(r.phone).includes(queryDigits);
  });
  out.sort((a, b) => (sort === 'oldest' ? 1 : -1) * String(a.submittedAt).localeCompare(String(b.submittedAt)));
  return out;
}

/** Totals across all responses. Attending guests = sum of guest counts on "yes" parties. */
export function summarise(rows) {
  let attendingParties = 0;
  let attendingGuests = 0;
  let declined = 0;
  for (const r of rows) {
    if (r.attendance === 'yes') {
      attendingParties += 1;
      attendingGuests += Number(r.guests) || 0;
    } else if (r.attendance === 'no') declined += 1;
  }
  return { total: rows.length, attendingParties, attendingGuests, declined };
}

/** Neutralises spreadsheet formulas (=, +, -, @) and quotes every cell. */
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows, timeZone = 'Indian/Maldives') {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const header = ['Guest name', 'Phone number', 'Attendance', 'Number of guests', 'Submitted (Maldives time)', 'Submitted (UTC ISO)'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.name, r.phone ?? '', r.attendance === 'yes' ? 'Yes' : 'No', r.guests, fmt.format(new Date(r.submittedAt)), r.submittedAt]
        .map(csvCell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
