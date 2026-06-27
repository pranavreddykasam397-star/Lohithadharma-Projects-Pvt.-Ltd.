/**
 * Reusable Framer Motion variants for Lohitha Dharma Projects CRM.
 * Enforces visual consistency, timing, and luxury brand rhythm.
 */

// Premium transition timing configurations
export const luxuryTransition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.8
};

export const slowBreatheTransition = {
  duration: 4,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "reverse"
};

// 1. Page & Card transitions
export const pageTransitionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { ...luxuryTransition }
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    transition: { duration: 0.15 } 
  }
};

// 2. Modal overlay & content animations
export const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

export const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0, 
    transition: { ...luxuryTransition }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10, 
    transition: { duration: 0.15 } 
  }
};

// 3. Card Breathe Hover & Glowing states
export const cardHoverVariants = {
  hover: {
    y: -4,
    scale: 1.01,
    boxShadow: "0 12px 30px rgba(197, 168, 128, 0.12)",
    borderColor: "rgba(197, 168, 128, 0.6)",
    transition: { duration: 0.3, ease: "easeOut" }
  },
  breathe: {
    scale: [1, 1.008, 1],
    boxShadow: [
      "0 4px 20px rgba(0,0,0,0.2)",
      "0 4px 25px rgba(197, 168, 128, 0.05)",
      "0 4px 20px rgba(0,0,0,0.2)"
    ],
    transition: { ...slowBreatheTransition }
  }
};

// 4. Staggered List entries
export const listContainerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06
    }
  }
};

export const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...luxuryTransition }
  }
};
