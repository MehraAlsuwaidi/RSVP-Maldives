import { useMemo, useRef } from 'react';
import { useInView } from '../hooks/useInView.js';
import { useIsCompact, usePrefersReducedMotion } from '../hooks/useMedia.js';
import { seeded } from '../utils/random.js';

// Default zones keep particles in the side margins, away from text and forms.
const EDGE_ZONES = [
  [0, 14, 4, 96],
  [86, 100, 4, 96],
];

/**
 * Decorative twinkling sparkles. Ignores pointer events, uses only transform
 * and opacity, halves its count on phones and pauses when offscreen.
 */
export default function Sparkles({ count = 18, zones = EDGE_ZONES, seed = 7, starRatio = 0.25, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const compact = useIsCompact();
  const reduced = usePrefersReducedMotion();
  const total = Math.max(3, Math.round(compact ? count * 0.5 : count));

  const particles = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: total }, (_, i) => {
      const [x0, x1, y0, y1] = zones[i % zones.length];
      const star = rand() < starRatio;
      return {
        key: i,
        star,
        style: {
          left: `${x0 + rand() * (x1 - x0)}%`,
          top: `${y0 + rand() * (y1 - y0)}%`,
          '--size': `${star ? 9 + rand() * 8 : 3 + rand() * 4}px`,
          '--dur': `${4.5 + rand() * 4}s`,
          '--delay': `${-rand() * 8}s`,
          '--drift': `${-6 - rand() * 10}px`,
        },
      };
    });
  }, [total, zones, seed, starRatio]);

  return (
    <div
      ref={ref}
      className={`sparkles ${className}`}
      data-paused={!inView || undefined}
      data-static={reduced || undefined}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span key={p.key} className={p.star ? 'sparkle sparkle--star' : 'sparkle'} style={p.style} />
      ))}
    </div>
  );
}
