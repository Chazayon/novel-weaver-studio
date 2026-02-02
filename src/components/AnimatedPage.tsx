import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedPageProps {
    children: React.ReactNode;
    className?: string;
    noLayout?: boolean; // Use this to disable layout animations if needed
}

// Standard page transition
// Slight upward drift + fade in
const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.99
    },
    in: {
        opacity: 1,
        y: 0,
        scale: 1
    },
    out: {
        opacity: 0,
        y: -20,
        scale: 0.99
    }
};

const pageTransition = {
    type: "tween",
    ease: [0.25, 0.1, 0.25, 1], // Custom cubic-bezier for "premium" feel
    duration: 0.4
} as const;

const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className = "", noLayout = false }) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className={`w-full h-full flex flex-col ${className}`}
        // layout={!noLayout} // Optional: automatic layout animations
        >
            {children}
        </motion.div>
    );
};

export default AnimatedPage;
