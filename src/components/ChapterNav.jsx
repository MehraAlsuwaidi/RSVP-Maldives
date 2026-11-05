import { CHAPTERS } from '../config/event.js';

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Discreet chapter dots + a small Continue control. Scrolling stays under the guest's control. */
export default function ChapterNav({ active, onGo }) {
  const last = active >= CHAPTERS.length - 1;
  return (
    <nav className="chapter-nav" aria-label="Invitation chapters" data-last={last || undefined}>
      <ol className="chapter-nav__dots">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              className="chapter-nav__dot"
              aria-current={i === active ? 'true' : undefined}
              aria-label={`Chapter ${i + 1}: ${c.label}`}
              onClick={() => onGo(i)}
            >
              <span className="chapter-nav__label" aria-hidden="true">
                {c.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="chapter-nav__continue" onClick={() => onGo(Math.min(active + 1, CHAPTERS.length - 1))} tabIndex={last ? -1 : 0}>
        Continue
        <Chevron />
      </button>
    </nav>
  );
}
