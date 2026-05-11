import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [prevLocation, setPrevLocation] = useState(location);

  useEffect(() => {
    if (location !== prevLocation) {
      setPrevLocation(location);
    }
  }, [location, prevLocation]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
