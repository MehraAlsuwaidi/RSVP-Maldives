/**
 * RSVP submission service. The form only calls `submitRsvp` and reads
 * `isPreviewMode`; how responses are delivered is decided here.
 *
 * - Live mode (VITE_RSVP_ENDPOINT set): POST JSON to the server, and only
 *   resolve once the server confirms the response was saved ({ ok: true, id }).
 * - Preview mode (no endpoint): nothing leaves the browser. The result is
 *   flagged `preview: true` so the UI never claims the host received it.
 */
import { RSVP_CONFIG } from '../config/event.js';

export const isPreviewMode = !RSVP_CONFIG.endpoint;

export class RsvpSubmissionError extends Error {
  constructor(message, { kind = 'unknown', fieldErrors = null } = {}) {
    super(message);
    this.name = 'RsvpSubmissionError';
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

export function createSubmissionId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{attendance:'yes'|'no', name:string, phone:string, guests?:number, guestNames?:string[], submissionId:string}} rsvp
 * @returns {Promise<{ preview: boolean, id?: string }>}
 */
export async function submitRsvp(rsvp) {
  if (isPreviewMode) {
    await wait(900);
    return { preview: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RSVP_CONFIG.timeoutMs);
  let response;
  try {
    response = await fetch(RSVP_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(rsvp),
      signal: controller.signal,
    });
  } catch (error) {
    throw new RsvpSubmissionError(
      error?.name === 'AbortError'
        ? 'The connection took too long, so we can’t be sure your RSVP arrived. Please try again — your details are still here.'
        : 'We couldn’t reach the castle. Please check your connection and try again — your details are still here.',
      { kind: 'network' },
    );
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    /* handled below */
  }

  if (response.ok && body?.ok === true && body.id) return { preview: false, id: body.id };

  if (response.status === 409 && body?.error === 'phone_registered') {
    throw new RsvpSubmissionError('This phone number has already been registered for this event.', {
      kind: 'duplicate-phone',
      fieldErrors: body.errors || null,
    });
  }
  if (response.status === 400 && body?.errors) {
    throw new RsvpSubmissionError('Please check the highlighted details.', {
      kind: 'validation',
      fieldErrors: body.errors,
    });
  }
  if (response.status === 429) {
    throw new RsvpSubmissionError('Too many attempts in a short time. Please wait a minute, then try again.', {
      kind: 'rate-limit',
    });
  }
  throw new RsvpSubmissionError(
    'Something went wrong and your RSVP wasn’t saved. Please try again in a moment — your details are still here.',
    { kind: 'server' },
  );
}
