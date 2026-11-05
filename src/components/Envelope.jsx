import { useEffect, useRef, useState } from 'react';
import { COPY } from '../config/event.js';
import { usePrefersReducedMotion } from '../hooks/useMedia.js';
import { NamesLogo, TitleLogo } from './Logo.jsx';
import Sparkles from './Sparkles.jsx';
import { Star } from './Ornaments.jsx';

/**
 * Stage timeline (ms from the tap). Total ≈ 2.3 s.
 *   seal     0    seal glints with a small sparkle
 *   flap     420  seal lifts away, flap rotates open from its top edge
 *   card     1000 ivory card slides up out of the envelope
 *   dissolve 1650 whole screen softly dissolves (waits for artwork if needed)
 *   done     2300 overlay removed, focus moves into the invitation
 */
const TIMELINE = [
  ['flap', 420],
  ['card', 1000],
  ['dissolve', 1650],
];
const DISSOLVE_MS = 650;

function EmbossedRose({ x, y, scale = 1, rotate = 0 }) {
  const d =
    'M0 0c1.6-2.4 5-1.8 5 1.4 0 3.4-4.2 5-6.8 2.6C-4.4 1.4-2.8-4.2 1.6-5.4c5-1.3 8.8 2.4 8.4 6.8-.5 5.6-6 8.6-11 7.2' +
    'M10 1.4c4 1.6 8 1 10.6-1.6M-1.4 8.6c-1 4-4 6.4-8 7M20.6-.2c-3.2-3.4-7.6-3-9.4.2 3 1.8 7 1.6 9.4-.2zM-9.4 15.6c.4-4.4 3.6-6.8 7.2-6-1 3.6-3.8 5.8-7.2 6z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} fill="none" strokeWidth="0.9" strokeLinecap="round">
      <path d={d} stroke="rgba(255,248,242,.75)" transform="translate(-.5 -.5)" />
      <path d={d} stroke="rgba(150,82,96,.28)" transform="translate(.5 .6)" />
    </g>
  );
}

function WaxSeal() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="wax" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#e69aa8" />
          <stop offset=".55" stopColor="#c46a7d" />
          <stop offset="1" stopColor="#99485b" />
        </radialGradient>
        <radialGradient id="waxInner" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#b85d71" />
          <stop offset="1" stopColor="#d27f90" />
        </radialGradient>
      </defs>
      <path
        d="M40 3c6 0 8 3 13 4s9 1 12 6 2 8 5 12 6 7 5 13-4 8-4 13 1 10-3 14-9 3-13 6-7 6-14 6-9-4-14-6-10-1-13-6-1-9-3-13-6-8-6-14 4-8 5-13 0-9 4-12 8-3 13-6S34 3 40 3z"
        fill="url(#wax)"
      />
      <circle cx="40" cy="40" r="25" fill="url(#waxInner)" stroke="#a8556a" strokeWidth="1.2" />
      <circle cx="40" cy="40" r="22" fill="none" stroke="#e8b0bb" strokeWidth=".7" opacity=".7" />
      <path
        d="M40 53s-12.5-7.6-12.5-15.2a6.4 6.4 0 0 1 12.5-2 6.4 6.4 0 0 1 12.5 2C52.5 45.4 40 53 40 53z"
        fill="#c66f82"
        stroke="#f3cfd5"
        strokeWidth="1.3"
      />
      <path d="M33 34.5c1.2-1.8 3.4-2 4.6-.8" stroke="#fbe3e7" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <ellipse cx="29" cy="22" rx="8" ry="4" fill="#fff" opacity=".22" transform="rotate(-30 29 22)" />
    </svg>
  );
}

export default function Envelope({ ready, onDissolveStart, onComplete }) {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState('closed');
  const [logosLoaded, setLogosLoaded] = useState(0);
  const startedRef = useRef(false);
  const readyRef = useRef(ready);
  const timers = useRef([]);
  readyRef.current = ready;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Once at "card", only dissolve when the invitation artwork is ready.
  const [awaitingArt, setAwaitingArt] = useState(false);
  useEffect(() => {
    if (awaitingArt && ready) {
      setAwaitingArt(false);
      dissolve();
    }
  }, [awaitingArt, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  function dissolve() {
    setStage('dissolve');
    onDissolveStart?.();
    later(() => {
      setStage('done');
      onComplete?.();
    }, reduced ? 320 : DISSOLVE_MS);
  }

  function open() {
    if (startedRef.current) return; // repeated taps never restart the sequence
    startedRef.current = true;

    if (reduced) {
      if (readyRef.current) dissolve();
      else setAwaitingArt(true);
      return;
    }

    setStage('seal');
    TIMELINE.forEach(([name, at]) =>
      later(() => {
        if (name === 'dissolve') {
          if (readyRef.current) dissolve();
          else setAwaitingArt(true);
        } else {
          setStage(name);
        }
      }, at),
    );
  }

  const countLoaded = () => setLogosLoaded((n) => n + 1);
  const opened = stage !== 'closed';

  return (
    <div
      className="envelope-screen"
      data-stage={stage}
      data-reduced={reduced || undefined}
      data-loaded={logosLoaded >= 2 || undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Your invitation"
    >
      <div className="envelope-screen__sky" aria-hidden="true" />
      <Sparkles
        count={22}
        seed={3}
        zones={[
          [4, 30, 4, 40],
          [70, 96, 4, 40],
          [2, 14, 40, 96],
          [86, 98, 40, 96],
        ]}
      />

      <div className="envelope-stage">
        <div className="envelope-stage__logo">
          <TitleLogo onLoad={countLoaded} onError={countLoaded} fetchpriority="high" />
        </div>

        <button
          type="button"
          className="envelope"
          onClick={open}
          aria-disabled={opened || undefined}
          aria-describedby="envelope-instruction"
          aria-label="Open your invitation from Hermione, Isabella and Selena"
        >
          <span className="envelope__body">
            <svg className="envelope__back" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="envInside" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#d99ea6" />
                  <stop offset="1" stopColor="#ecc3c4" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="300" height="200" rx="6" fill="url(#envInside)" />
            </svg>

            <span className="envelope__card" aria-hidden="true">
              <span className="envelope__card-inner">
                <Star className="envelope__card-star" />
                <span className="envelope__card-kicker">You are invited</span>
                <span className="envelope__card-line" />
              </span>
            </span>

            <svg className="envelope__pocket" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="pocketSides" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#efc6c6" />
                  <stop offset=".5" stopColor="#f6d6d4" />
                  <stop offset="1" stopColor="#efc6c6" />
                </linearGradient>
                <linearGradient id="pocketBottom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f8dcd9" />
                  <stop offset="1" stopColor="#f1cbca" />
                </linearGradient>
              </defs>
              <path d="M0 0 L150 106 L300 0 V194 a6 6 0 0 1 -6 6 H6 a6 6 0 0 1 -6 -6Z" fill="url(#pocketSides)" />
              <path d="M2 199 L150 98 L298 199Z" fill="url(#pocketBottom)" />
              <g fill="none" stroke="var(--gold)" strokeLinecap="round">
                <path d="M3 198 L150 98 L297 198" strokeWidth="1" opacity=".85" />
                <path d="M2 2 L150 106 L298 2" strokeWidth="1" opacity=".55" />
                <rect x="4" y="4" width="292" height="192" rx="4" strokeWidth="1.2" opacity=".9" />
                <rect x="8" y="8" width="284" height="184" rx="3" strokeWidth=".5" opacity=".55" />
              </g>
              <EmbossedRose x={44} y={160} scale={1.05} rotate={-12} />
              <EmbossedRose x={258} y={162} scale={0.95} rotate={160} />
              <EmbossedRose x={150} y={176} scale={0.8} rotate={8} />
            </svg>

            <span className="envelope__flap" aria-hidden="true">
              <span className="envelope__flap-face envelope__flap-face--front">
                <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="flapFront" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#f3cfcd" />
                      <stop offset="1" stopColor="#f9e0dc" />
                    </linearGradient>
                  </defs>
                  <path d="M0 0 H300 L163 111 Q150 121 137 111Z" fill="url(#flapFront)" />
                  <path d="M3 2 L139 109 Q150 117.5 161 109 L297 2" fill="none" stroke="var(--gold)" strokeWidth="1.2" />
                  <path d="M12 6 L141 104 Q150 111 159 104 L288 6" fill="none" stroke="var(--gold)" strokeWidth=".5" opacity=".6" />
                  <EmbossedRose x={150} y={44} scale={0.9} />
                </svg>
              </span>
              <span className="envelope__flap-face envelope__flap-face--back">
                <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                  <path d="M0 0 H300 L163 111 Q150 121 137 111Z" fill="#ebbcbf" />
                  <path d="M3 2 L139 109 Q150 117.5 161 109 L297 2" fill="none" stroke="var(--gold)" strokeWidth="1" opacity=".7" />
                </svg>
              </span>
            </span>

            <span className="envelope__seal">
              <span className="envelope__seal-glow" />
              <WaxSeal />
              <span className="envelope__burst">
                {Array.from({ length: 6 }, (_, i) => (
                  <Star key={i} className="envelope__burst-star" style={{ '--i': i }} />
                ))}
              </span>
            </span>
          </span>
        </button>

        <div className="envelope-stage__names">
          <NamesLogo onLoad={countLoaded} onError={countLoaded} fetchpriority="high" />
        </div>

        <p id="envelope-instruction" className="envelope-stage__hint">
          {awaitingArt ? 'Preparing your invitation…' : COPY.envelopeInstruction}
        </p>
      </div>
    </div>
  );
}
