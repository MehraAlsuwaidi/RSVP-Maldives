import { motion } from 'framer-motion';

/** Fine gold divider with a small heart, drawn in when it scrolls into view. */
export function Flourish({ className = '' }) {
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    shown: { pathLength: 1, opacity: 1, transition: { duration: 1.4, ease: 'easeInOut' } },
  };
  return (
    <motion.svg
      className={`flourish ${className}`}
      viewBox="0 0 240 28"
      aria-hidden="true"
      focusable="false"
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.8 }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <motion.path variants={draw} d="M104 14 C 84 14, 74 5, 58 9 S 38 22, 22 14 S 8 8, 2 14" />
        <motion.path variants={draw} d="M136 14 C 156 14, 166 5, 182 9 S 202 22, 218 14 S 232 8, 238 14" />
        <motion.path variants={draw} d="M58 9 c -4 -5 -10 -4 -11 1" />
        <motion.path variants={draw} d="M182 9 c 4 -5 10 -4 11 1" />
      </g>
      <path
        d="M120 21.5s-8.5-5.2-8.5-10.4a4.3 4.3 0 0 1 8.5-1.3 4.3 4.3 0 0 1 8.5 1.3c0 5.2-8.5 10.4-8.5 10.4z"
        fill="var(--rose-400)"
        stroke="var(--gold)"
        strokeWidth="0.8"
      />
    </motion.svg>
  );
}

/** Gold filigree corner; rotate with CSS for the other three corners. */
export function Corner({ className = '' }) {
  return (
    <svg className={`corner ${className}`} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M4 60 V 14 a 10 10 0 0 1 10 -10 H 60" />
        <path d="M10 46 V 18 a 8 8 0 0 1 8 -8 H 46" opacity="0.7" />
        <path d="M18 30 c 0 -8 4 -12 12 -12 c -2 6 -6 10 -12 12z" />
        <path d="M22 22 c 6 0 10 2 12 8" opacity="0.8" />
        <path d="M4 60 c 0 6 3 9 8 9" />
        <path d="M60 4 c 6 0 9 3 9 8" />
      </g>
      <circle cx="14" cy="14" r="2.4" fill="var(--pearl)" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="12" cy="69" r="1.6" fill="var(--pearl)" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="69" cy="12" r="1.6" fill="var(--pearl)" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

export function FramedCorners() {
  return (
    <>
      <Corner className="corner--tl" />
      <Corner className="corner--tr" />
      <Corner className="corner--bl" />
      <Corner className="corner--br" />
    </>
  );
}

/** Four-point star used in sparkles and the RSVP flourish. */
export function Star({ className = '', style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 0 C 10.8 6.6 13.4 9.2 20 10 C 13.4 10.8 10.8 13.4 10 20 C 9.2 13.4 6.6 10.8 0 10 C 6.6 9.2 9.2 6.6 10 0Z" fill="currentColor" />
    </svg>
  );
}
