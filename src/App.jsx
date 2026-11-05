import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { ASSETS, CHAPTERS } from './config/event.js';
import Envelope from './components/Envelope.jsx';
import ChapterNav from './components/ChapterNav.jsx';
import InvitationChapter from './chapters/InvitationChapter.jsx';
import GatesChapter from './chapters/GatesChapter.jsx';
import CelebrationChapter from './chapters/CelebrationChapter.jsx';
import AttireChapter from './chapters/AttireChapter.jsx';
import RsvpChapter from './chapters/RsvpChapter.jsx';
import { isPreviewMode } from './services/rsvpService.js';
import { preloadImages } from './utils/preload.js';

// Artwork that must be ready before the envelope dissolves into the invitation.
const FIRST_SCREEN = [ASSETS.logoTitle.src, ASSETS.logoNames.src, ASSETS.invitationArt.src || ASSETS.ballroom.src, ASSETS.courtyard.src, ASSETS.roseCluster.src];
const LATER = [ASSETS.approach.src, ASSETS.celebrating.src];

export default function App() {
  const [phase, setPhase] = useState('envelope'); // envelope | revealing | open
  const [artReady, setArtReady] = useState(false);
  const [active, setActive] = useState(0);
  const mainRef = useRef(null);
  const headingRef = useRef(null);
  const sectionRefs = useRef([]);

  useEffect(() => {
    let alive = true;
    preloadImages(FIRST_SCREEN).then(() => {
      if (!alive) return;
      setArtReady(true);
      preloadImages(LATER);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Lock page scroll and make the invitation inert while the envelope is shown.
  useEffect(() => {
    const root = document.documentElement;
    const locked = phase === 'envelope';
    root.classList.toggle('is-locked', locked);
    if (mainRef.current) mainRef.current.inert = locked;
    return () => root.classList.remove('is-locked');
  }, [phase]);

  // Track the chapter in view for the indicators.
  useEffect(() => {
    if (phase === 'envelope') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(sectionRefs.current.indexOf(entry.target));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [phase]);

  const onDissolveStart = useCallback(() => {
    window.scrollTo(0, 0);
    setPhase('revealing');
  }, []);
  const onComplete = useCallback(() => {
    setPhase('open');
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const goTo = useCallback((index) => {
    const el = sectionRefs.current[index];
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const heading = el.querySelector('h1, h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, []);

  const setSection = (i) => (el) => {
    sectionRefs.current[i] = el;
  };

  return (
    <MotionConfig reducedMotion="user">
      {isPreviewMode && (
        <p className="preview-badge" role="note">
          Preview mode · RSVPs are not sent
        </p>
      )}
      {phase !== 'envelope' && (
        <a className="skip-link" href="#rsvp">
          Skip to RSVP
        </a>
      )}

      <main ref={mainRef} className="journey" id="main">
        <InvitationChapter ref={setSection(0)} headingRef={headingRef} />
        <GatesChapter ref={setSection(1)} />
        <CelebrationChapter ref={setSection(2)} />
        <AttireChapter ref={setSection(3)} />
        <RsvpChapter ref={setSection(4)} />
      </main>

      {phase !== 'envelope' && <ChapterNav active={Math.max(0, Math.min(active, CHAPTERS.length - 1))} onGo={goTo} />}

      {phase !== 'open' && <Envelope ready={artReady} onDissolveStart={onDissolveStart} onComplete={onComplete} />}
    </MotionConfig>
  );
}
