import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// ページ内リンク(/#reserve, /kodawari#fire)をクライアント遷移でも効かせる。
// ハッシュがなければ、ページが変わったときに先頭へ戻す
export const useHashScroll = () => {
  const { pathname, hash, key } = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    // 同じページ内の移動だけなめらかにスクロールする(別ページからは即座に)
    const samePage = prevPath.current === pathname;
    prevPath.current = pathname;
    if (!hash) {
      if (samePage) return;
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const smooth = samePage && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tries = 0;
    let raf = 0;
    // 遷移直後は要素がまだないことがあるので、少しの間待つ
    const tick = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        return;
      }
      if (tries++ < 60) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, key]);
};
