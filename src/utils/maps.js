import { EVENT } from '../config/event.js';

/** A text search for the exact supplied address — no invented coordinates or pins. */
export const mapSearchUrl = (query = EVENT.venue.mapSearchQuery) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
