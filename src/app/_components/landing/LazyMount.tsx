"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  minHeightClassName?: string;
}

export function LazyMount({ children, minHeightClassName = "min-h-[200px]" }: LazyMountProps) {
  const [isMounted, setIsMounted] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={hostRef} className={isMounted ? "" : minHeightClassName}>{isMounted ? children : null}</div>;
}
