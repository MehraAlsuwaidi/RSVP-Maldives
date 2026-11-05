import { motion } from 'framer-motion';

const EASE = [0.22, 0.61, 0.36, 1];

/** Gentle fade + short upward reveal when scrolled into view (fade only under reduced motion). */
export default function Reveal({ as = 'div', delay = 0, y = 14, amount = 0.35, children, ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
