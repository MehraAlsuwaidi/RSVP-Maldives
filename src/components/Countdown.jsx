import { useEffect, useRef, useState } from 'react';
import { COPY, EVENT } from '../config/event.js';
import { useInView } from '../hooks/useInView.js';

const START = Date.parse(EVENT.start);
const END = Date.parse(EVENT.end);

function parts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000)); // never negative
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Restrained countdown; ticks only while visible. */
export default function Countdown() {
  const ref = useRef(null);
  const visible = useInView(ref, '0px');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  if (now >= END) {
    return (
      <div className="countdown" ref={ref}>
        <p className="countdown__message">{COPY.countdown.after}</p>
      </div>
    );
  }
  if (now >= START) {
    return (
      <div className="countdown" ref={ref}>
        <p className="countdown__message">{COPY.countdown.during}</p>
      </div>
    );
  }

  const p = parts(START - now);
  const cells = [
    [p.days, 'Days'],
    [p.hours, 'Hours'],
    [p.minutes, 'Minutes'],
    [p.seconds, 'Seconds'],
  ];
  const spoken = `${plural(p.days, 'day')}, ${plural(p.hours, 'hour')} and ${plural(p.minutes, 'minute')} to go`;

  return (
    <div className="countdown" ref={ref}>
      <p className="countdown__label" id="countdown-label">
        Counting down to the magic
      </p>
      {/* role="timer" is not announced on every tick; the summary below is read on demand. */}
      <div className="countdown__grid" role="timer" aria-labelledby="countdown-label" aria-describedby="countdown-spoken">
        {cells.map(([value, unit]) => (
          <div className="countdown__cell" key={unit} aria-hidden="true">
            <span className="countdown__value">{String(value).padStart(2, '0')}</span>
            <span className="countdown__unit">{unit}</span>
          </div>
        ))}
      </div>
      <p className="sr-only" id="countdown-spoken">
        {spoken}
      </p>
    </div>
  );
}
