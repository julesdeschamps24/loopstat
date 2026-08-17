"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

/**
 * Motion primitives - a thin wrapper around framer-motion idioms used across
 * the app (dashboard top-5, top-page lists, currently-playing widget).
 *
 * Keeping the framer-motion surface localised here means call sites only see
 * named primitives - never raw `motion.*` - so swapping the animation library
 * later stays a single-file change.
 *
 * Each primitive honours `prefers-reduced-motion` via `useReducedMotion()`:
 * when the user opts out, transitions collapse to 0ms and transforms are
 * dropped, but content still swaps so the UI stays functional.
 */

const parentVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

type StaggerAs = "div" | "ul" | "ol";

export type StaggerListProps = HTMLMotionProps<"div"> & {
  as?: StaggerAs;
};

/** Auto-animated container that staggers its `StaggerItem` children on mount. */
export function StaggerList({ as = "div", children, ...rest }: StaggerListProps) {
  const reduce = useReducedMotion();
  // `as` is constrained to a small set of block-like tags; the cast keeps the
  // shared div-typed props compatible across them without full polymorphism.
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      initial="hidden"
      animate="show"
      variants={reduce ? undefined : parentVariants}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type StaggerItemProps = HTMLMotionProps<"div">;

/** A single staggered child - fades up 8px when motion is allowed. */
export function StaggerItem({ children, ...rest }: StaggerItemProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? undefined : itemVariants}
      transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export type FadeSwapProps = {
  motionKey: string | number;
  children: React.ReactNode;
  className?: string;
};

/** Cross-fade swappable content keyed by `motionKey` (200ms). */
export function FadeSwap({ motionKey, children, className }: FadeSwapProps) {
  const reduce = useReducedMotion();
  const duration = reduce ? 0 : 0.2;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
