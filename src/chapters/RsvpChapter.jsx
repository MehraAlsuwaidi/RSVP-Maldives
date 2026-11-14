import { forwardRef, useEffect, useRef } from 'react';
import { ASSETS, COPY } from '../config/event.js';
import { NamesLogo } from '../components/Logo.jsx';
import Reveal from '../components/Reveal.jsx';
import RsvpForm from '../components/RsvpForm.jsx';
import Sparkles from '../components/Sparkles.jsx';

/** Chapter 5 — calm, framed RSVP. */
const RsvpChapter = forwardRef(function RsvpChapter(_, ref) {
  const cardRef = useRef(null);

  // Once the guest starts using the form, turn scroll snapping off for good. Re-enabling it
  // on blur made the page jump between press and release, so taps (e.g. on "No") missed.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const on = () => document.documentElement.classList.add('is-form-active');
    el.addEventListener('focusin', on);
    el.addEventListener('pointerdown', on);
    return () => {
      el.removeEventListener('focusin', on);
      el.removeEventListener('pointerdown', on);
      document.documentElement.classList.remove('is-form-active');
    };
  }, []);

  return (
    <section id="rsvp" ref={ref} className="chapter chapter--rsvp" aria-labelledby="rsvp-title">
      <div className="chapter__backdrop" style={{ '--bg': `url(${ASSETS.courtyard.src})` }} aria-hidden="true" />
      <Sparkles count={14} seed={51} zones={[[0, 8, 5, 95], [92, 100, 5, 95]]} />
      <Reveal className="panel rsvp-card" amount={0.15}>
        <div ref={cardRef}>
          <img className="rose-cluster rose-cluster--tl" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
          <img className="rose-cluster rose-cluster--br" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
          <h2 id="rsvp-title" className="rsvp__heading">
            {COPY.rsvp.heading}
          </h2>
          <p className="rsvp__intro">Kindly let us know by choosing below.</p>
          <RsvpForm />
          <div className="rsvp-signoff">
            <p>{COPY.rsvp.signOff}</p>
            <NamesLogo />
          </div>
        </div>
      </Reveal>
    </section>
  );
});

export default RsvpChapter;
