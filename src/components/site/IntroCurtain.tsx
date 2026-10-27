import { useEffect, useState } from "react";

const KEY = "u-intro-seen";

// 初回訪問(セッション内1回)だけ、ロゴが立ち上がってから幕が上がる短い導入。
// 合計 1.4 秒程度に抑え、予約の妨げにならないようにする
export const IntroCurtain = ({ onLift }: { onLift: () => void }) => {
  const [phase, setPhase] = useState<"show" | "lift" | "done">(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "done";
      if (sessionStorage.getItem(KEY)) return "done";
    } catch {
      return "done";
    }
    return "show";
  });

  useEffect(() => {
    if (phase === "done") {
      onLift();
      return;
    }
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* 保存できなくても動作に影響はない */
    }
    const t1 = window.setTimeout(() => {
      setPhase("lift");
      onLift();
    }, 1000);
    const t2 = window.setTimeout(() => setPhase("done"), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-u-ink transition-[clip-path] duration-[900ms] [transition-timing-function:var(--u-ease-in-out)]"
      style={{ clipPath: phase === "lift" ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-5">
        <span className="u-mark w-16 text-u-mist" style={{ animation: "u-rise 1s var(--u-ease) both" }} />
        <span className="u-latin text-lg italic tracking-[0.1em] text-u-paper/70" style={{ animation: "u-fade-up .8s var(--u-ease) .25s both" }}>
          U sauna
        </span>
      </div>
    </div>
  );
};
