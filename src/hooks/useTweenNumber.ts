import { useEffect, useRef, useState } from "react";

// 数値が変わったとき、前の値から滑らかに数え上げる(合計金額の表示用)
export const useTweenNumber = (target: number | null, duration = 700) => {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(2, -10 * t);
      const v = Math.round(from + (target - from) * (t === 1 ? 1 : eased));
      fromRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
};
