import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// 画面に入ったら一度だけ .is-in を付ける(以降は監視しない)
export const useInView = <T extends Element>(options?: IntersectionObserverInit) => {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08, ...options }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [options]);
  return ref;
};

interface RevealProps {
  children?: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  delay?: number;
  className?: string;
  variant?: "fade" | "line";
  id?: string;
}

export const Reveal = ({ children, as = "div", delay = 0, className, variant = "fade", id }: RevealProps) => {
  const ref = useInView<HTMLElement>();
  return createElement(
    as,
    {
      ref,
      id,
      className: cn(variant === "line" ? "u-reveal-line" : "u-reveal", className),
      style: { "--u-delay": `${delay}ms` } as CSSProperties,
    },
    children
  );
};
