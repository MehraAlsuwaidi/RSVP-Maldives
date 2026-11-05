import { forwardRef, useState } from 'react';
import { ASSETS, EVENT } from '../config/event.js';
import Countdown from '../components/Countdown.jsx';
import { Flourish } from '../components/Ornaments.jsx';
import Reveal from '../components/Reveal.jsx';
import Sparkles from '../components/Sparkles.jsx';
import { downloadIcs } from '../utils/calendar.js';
import { mapSearchUrl } from '../utils/maps.js';

const PinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4M10 15.5h4" />
  </svg>
);

/** Chapter 3 — the ballroom, the event details and practical actions. */
const CelebrationChapter = forwardRef(function CelebrationChapter(_, ref) {
  const [status, setStatus] = useState('');

  const addToCalendar = () => {
    downloadIcs();
    setStatus('Your calendar file is downloading.');
  };

  return (
    <section id="celebration" ref={ref} className="chapter chapter--celebration" aria-labelledby="celebration-title">
      <div className="chapter__backdrop" style={{ '--bg': `url(${ASSETS.ballroom.src})` }} aria-hidden="true" />
      <Sparkles count={14} seed={31} />
      <div className="scene">
        <Reveal as="figure" className="scene__figure" y={0} amount={0.15}>
          <img
            src={ASSETS.ballroom.src}
            width={ASSETS.ballroom.width}
            height={ASSETS.ballroom.height}
            alt={ASSETS.ballroom.alt}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: ASSETS.ballroom.focal }}
          />
        </Reveal>

        <Reveal className="panel scene__panel details" amount={0.2}>
          <p className="kicker">You are invited to</p>
          <h2 id="celebration-title" className="details__heading">
            The Celebration
          </h2>
          <Flourish />
          <dl className="details__list">
            <div className="details__item">
              <dt>Date</dt>
              <dd>{EVENT.dateLabel}</dd>
            </div>
            <div className="details__item">
              <dt>Time</dt>
              <dd>{EVENT.timeLabel}</dd>
            </div>
            <div className="details__item">
              <dt>{EVENT.venue.label}</dt>
              <dd>{EVENT.venue.address}</dd>
            </div>
          </dl>
          <p className="details__note">{EVENT.timeNote}</p>

          <div className="details__actions">
            <a className="btn btn--primary" href={mapSearchUrl()} target="_blank" rel="noopener noreferrer">
              <PinIcon />
              Find the venue
              <span className="sr-only"> (opens a map search in a new tab)</span>
            </a>
            <button type="button" className="btn btn--ghost" onClick={addToCalendar}>
              <CalendarIcon />
              Add to calendar
            </button>
          </div>
          <p className="details__status" role="status">
            {status}
          </p>

          <Countdown />
        </Reveal>
      </div>
    </section>
  );
});

export default CelebrationChapter;
