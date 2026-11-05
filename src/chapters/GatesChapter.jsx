import { forwardRef, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ASSETS, COPY } from '../config/event.js';
import Sparkles from '../components/Sparkles.jsx';

/**
 * Chapter 2 — a tall section with a sticky stage. As the guest scrolls, the
 * courtyard gently drifts closer and dissolves into the girls at the entrance.
 */
const GatesChapter = forwardRef(function GatesChapter(_, ref) {
  const trackRef = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  const approachOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);
  const courtyardScale = useTransform(scrollYProgress, [0, 0.7], reduced ? [1, 1] : [1.0, 1.12]);
  const courtyardY = useTransform(scrollYProgress, [0, 0.7], reduced ? ['0%', '0%'] : ['0%', '3%']);
  const approachScale = useTransform(scrollYProgress, [0.3, 1], reduced ? [1, 1] : [1.08, 1.0]);

  const setRefs = (el) => {
    trackRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <section id="gates" ref={setRefs} className="chapter chapter--gates" aria-labelledby="gates-title">
      <div className="gates__stage">
        <div className="chapter__backdrop" style={{ '--bg': `url(${ASSETS.courtyard.src})` }} aria-hidden="true" />
        <div className="gates__layout">
          <figure className="gates__figure">
            <motion.img
              src={ASSETS.courtyard.src}
              width={ASSETS.courtyard.width}
              height={ASSETS.courtyard.height}
              alt={ASSETS.courtyard.alt}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: ASSETS.courtyard.focal, scale: courtyardScale, y: courtyardY, transformOrigin: '50% 45%' }}
            />
            <motion.img
              src={ASSETS.approach.src}
              width={ASSETS.approach.width}
              height={ASSETS.approach.height}
              alt={ASSETS.approach.alt}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: ASSETS.approach.focal, opacity: approachOpacity, scale: approachScale }}
            />
          </figure>
          <motion.div
            className="panel gates__panel"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <h2 id="gates-title" className="kicker">
              Through the castle gates
            </h2>
            <p className="lead" style={{ marginTop: 10 }}>
              {COPY.gates}
            </p>
          </motion.div>
        </div>
        <Sparkles count={12} seed={21} zones={[[2, 14, 30, 70], [86, 98, 30, 70]]} />
      </div>
    </section>
  );
});

export default GatesChapter;
