/**
 * Everything a host might want to edit lives here: wording, date/time, venue,
 * asset paths and RSVP connection. Components read from these objects only.
 */

export const EVENT = {
  hosts: ['Hermione', 'Isabella', 'Selena'],
  title: 'A Magical Birthday Celebration',
  calendarTitle: 'Magical Birthday Celebration — Hermione, Isabella & Selena',
  calendarDescription:
    'Hermione, Isabella and Selena invite you to a magical birthday celebration. ' +
    'Little guests are invited to come dressed in their finest attire, and princesses in their most beautiful ballroom gowns.',

  // ISO 8601 with the Maldives offset (UTC+05:00). These drive the countdown and calendar file.
  start: '2026-11-21T16:30:00+05:00',
  end: '2026-11-21T19:30:00+05:00',
  timeZone: 'Indian/Maldives',

  // Pre-formatted for display so the invitation reads the same everywhere,
  // whatever the guest's own device time zone is.
  dateLabel: 'Saturday, 21 November 2026',
  timeLabel: '4:30 pm – 7:30 pm',
  timeNote: 'All event times are local to the Maldives.',

  venue: {
    label: 'Venue',
    address: 'LOT 20048, Nikagas Magu, phase 2, Hulhumalé',
    // A plain text search for the exact address. No coordinates or pins are invented.
    mapSearchQuery: 'LOT 20048, Nikagas Magu, phase 2, Hulhumalé, Maldives',
  },
};

export const COPY = {
  envelopeInstruction: 'Tap the seal to open your invitation.',
  invitation: {
    lines: ['invite you to join them', 'for a magical birthday celebration'],
    scrollCue: 'Scroll to discover the magic',
  },
  gates:
    'Step through the castle gates and join us for a day of enchantment, laughter and celebration.',
  attire: {
    first: [
      'All our little guests are invited to come dressed in their finest attire,',
      'and princesses are invited to wear their most beautiful ballroom gowns.',
    ],
    second: ['Come and celebrate with us', 'as we make magical memories together!'],
  },
  rsvp: {
    heading: 'Are you coming?',
    yes: 'Yes, I’ll be there',
    no: 'No, I can’t attend',
    guestsHelp: 'Include yourself and everyone attending with you.',
    submit: 'Send RSVP',
    successYes: 'Your RSVP is confirmed. We can’t wait to celebrate with you!',
    successNo: 'Thank you for letting us know. You’ll be missed!',
    signOff: 'With love,',
  },
  countdown: {
    during: 'The celebration has begun — come and join the magic!',
    after: 'Thank you for celebrating with us!',
  },
};

/**
 * Asset paths (served from /public). Optional artwork can be dropped into
 * public/assets and switched on here; the layout falls back gracefully.
 *
 * focal: CSS object-position used when an image must be cropped, chosen so
 * faces, the castle towers and the cake stay in view.
 */
export const ASSETS = {
  logoTitle: {
    src: '/assets/logo-magical-birthday.webp',
    alt: 'Magical Birthday',
    width: 1536,
    height: 1024,
  },
  logoNames: {
    src: '/assets/logo-names.webp',
    alt: 'Hermione, Isabella and Selena',
    width: 2000,
    height: 667,
  },
  roseCluster: { src: '/assets/rose-cluster.webp', width: 238, height: 356 },

  /**
   * Ornate invitation artwork (inivtation(1).jpg). Set `src` to e.g.
   * '/assets/invitation.jpg' to use it as the Chapter 1 composition, and tune
   * `textArea` (percentages of the artwork) to the empty ivory region.
   * While `src` is null, Chapter 1 is composed from the castle artwork instead.
   */
  invitationArt: {
    src: null,
    alt: 'Ornate invitation with the three girls, castles, pearls and roses',
    width: 1024,
    height: 1536,
    textArea: { top: '5%', left: '12%', right: '12%', height: '52%' },
  },

  courtyard: {
    src: '/assets/scene-1-courtyard.jpg',
    alt: 'A pink fairytale castle at sunset, with a rose-ringed fountain in the courtyard',
    width: 720,
    height: 1280,
    focal: '50% 45%',
  },
  approach: {
    src: '/assets/scene-2-approach.jpg',
    alt: 'Hermione, Isabella and Selena, hand in hand, walking up to the castle entrance',
    width: 720,
    height: 1280,
    focal: '45% 70%',
  },
  ballroom: {
    src: '/assets/scene-ballroom.jpg',
    alt: 'The three girls in their gowns in the castle ballroom, with a pink castle cake behind them',
    width: 720,
    height: 1280,
    focal: '50% 62%',
  },
  /**
   * scene_5.jpg (girls celebrating). Set `src` to '/assets/scene-5.jpg' once
   * added; until then the attire chapter uses a portrait crop of the ballroom.
   */
  celebrating: {
    src: null,
    alt: 'The three girls celebrating together in the ballroom',
    width: 720,
    height: 1280,
    focal: '50% 70%',
  },
};

/** Where RSVPs go. Empty endpoint = clearly labelled preview mode. */
export const RSVP_CONFIG = {
  endpoint: (import.meta.env.VITE_RSVP_ENDPOINT || '').trim(),
  timeoutMs: 15000,
  maxGuests: 20,
};

export const CHAPTERS = [
  { id: 'invitation', label: 'The invitation' },
  { id: 'gates', label: 'Through the castle gates' },
  { id: 'celebration', label: 'The celebration' },
  { id: 'attire', label: 'Royal attire' },
  { id: 'rsvp', label: 'RSVP' },
];
