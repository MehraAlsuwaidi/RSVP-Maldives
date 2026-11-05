import { forwardRef } from 'react';
import { ASSETS, COPY } from '../config/event.js';
import { NamesLogo, TitleLogo } from '../components/Logo.jsx';
import { FramedCorners } from '../components/Ornaments.jsx';
import Reveal from '../components/Reveal.jsx';
import Sparkles from '../components/Sparkles.jsx';

function Title({ headingRef }) {
  // Accessible name reads "A Magical Birthday Celebration": the logo's alt supplies the middle words.
  return (
    <h1 className="invite-title" ref={headingRef} tabIndex={-1}>
      <span className="invite-title__a">A</span> <TitleLogo /> <span className="invite-title__celebration">Celebration</span>
    </h1>
  );
}

function ScrollCue() {
  return (
    <a className="scroll-cue" href="#gates">
      {COPY.invitation.scrollCue}
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </a>
  );
}

const Lines = () => (
  <p className="invite-lines">
    {COPY.invitation.lines[0]}
    <br />
    {COPY.invitation.lines[1]}
  </p>
);

/** Chapter 1 — uses the ornate invitation artwork when supplied, otherwise a composed card. */
const InvitationChapter = forwardRef(function InvitationChapter({ headingRef }, ref) {
  const art = ASSETS.invitationArt;

  return (
    <section id="invitation" ref={ref} className="chapter chapter--invitation" aria-labelledby="invitation-title">
      <div className="chapter__backdrop" style={{ '--bg': `url(${ASSETS.courtyard.src})` }} aria-hidden="true" />
      <Sparkles count={20} seed={11} />

      {art.src ? (
        <article className="invite-art" id="invitation-title">
          <img src={art.src} width={art.width} height={art.height} alt={art.alt} />
          <div
            className="invite-art__text"
            style={{ top: art.textArea.top, left: art.textArea.left, right: art.textArea.right, height: art.textArea.height }}
          >
            <Title headingRef={headingRef} />
            <NamesLogo />
            <Lines />
          </div>
        </article>
      ) : (
        <article className="invite-card" id="invitation-title">
          <FramedCorners />
          <Title headingRef={headingRef} />
          <div className="pearls" aria-hidden="true" />
          <NamesLogo />
          <Lines />
          <Reveal className="invite-arch" amount={0.2}>
            <div className="invite-arch__window">
              <img
                src={ASSETS.ballroom.src}
                width={ASSETS.ballroom.width}
                height={ASSETS.ballroom.height}
                alt="Hermione, Isabella and Selena in their party gowns beneath a sparkling chandelier, with the castle cake behind them"
                decoding="async"
              />
            </div>
            <img className="rose-cluster rose-cluster--left" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
            <img className="rose-cluster rose-cluster--right" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
          </Reveal>
          <ScrollCue />
        </article>
      )}
    </section>
  );
});

export default InvitationChapter;
