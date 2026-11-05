import { forwardRef } from 'react';
import { ASSETS, COPY } from '../config/event.js';
import { Flourish } from '../components/Ornaments.jsx';
import Reveal from '../components/Reveal.jsx';
import Sparkles from '../components/Sparkles.jsx';

/** Chapter 4 — royal attire. Uses scene_5 when supplied, else a portrait medallion of the girls' gowns. */
const AttireChapter = forwardRef(function AttireChapter(_, ref) {
  const art = ASSETS.celebrating.src ? ASSETS.celebrating : null;
  const fallback = ASSETS.ballroom;

  return (
    <section id="attire" ref={ref} className="chapter chapter--attire" aria-labelledby="attire-title">
      <div className="chapter__backdrop" style={{ '--bg': `url(${(art || fallback).src})` }} aria-hidden="true" />
      <Sparkles count={16} seed={41} />
      <div className={art ? 'scene' : 'scene scene--medallion'}>
        {art ? (
          <Reveal as="figure" className="scene__figure" y={0} amount={0.15}>
            <img src={art.src} width={art.width} height={art.height} alt={art.alt} loading="lazy" decoding="async" style={{ objectPosition: art.focal }} />
          </Reveal>
        ) : (
          <div className="scene__figure-wrap">
            <Reveal as="figure" className="scene__figure scene__figure--medallion" y={0} amount={0.2}>
              <img
                src={fallback.src}
                width={fallback.width}
                height={fallback.height}
                alt="Isabella in a golden gown with rose appliqués, Hermione in a champagne tulle gown with pearls, and Selena in a blush party dress, clapping with delight"
                loading="lazy"
                decoding="async"
              />
            </Reveal>
            <img className="rose-cluster rose-cluster--left" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
            <img className="rose-cluster rose-cluster--right" src={ASSETS.roseCluster.src} alt="" aria-hidden="true" />
          </div>
        )}

        <div className="panel scene__panel">
          <Reveal as="h2" className="kicker" id="attire-title">
            Royal attire
          </Reveal>
          <Reveal as="p" className="attire__lines" delay={0.15} style={{ marginTop: 12 }}>
            {COPY.attire.first[0]}
            <br />
            {COPY.attire.first[1]}
          </Reveal>
          <Flourish />
          <Reveal as="p" className="attire__lines attire__lines--second" delay={0.3}>
            {COPY.attire.second[0]}
            <br />
            {COPY.attire.second[1]}
          </Reveal>
        </div>
      </div>
    </section>
  );
});

export default AttireChapter;
