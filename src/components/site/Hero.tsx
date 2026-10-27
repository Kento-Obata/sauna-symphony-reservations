import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

// 湯気の粒。位置・速度・揺れをずらして単調にならないようにする
const STEAM = [
  { left: "28%", size: 220, dur: 11, delay: -4, x: -40, o: 0.6 },
  { left: "44%", size: 280, dur: 13, delay: -1, x: 30, o: 0.55 },
  { left: "58%", size: 240, dur: 12, delay: -7, x: -20, o: 0.6 },
  { left: "36%", size: 180, dur: 10, delay: 7, x: 50, o: 0.4 },
  { left: "66%", size: 200, dur: 14, delay: 3.5, x: -60, o: 0.35 },
  { left: "50%", size: 320, dur: 15, delay: 8.5, x: 10, o: 0.4 },
];

const FACTS = [
  { k: "Private", v: "完全貸切" },
  { k: "Guests", v: "最大6名" },
  { k: "Session", v: "1回 150分" },
  { k: "Hands-free", v: "手ぶらOK" },
];

export const Hero = () => {
  const visualRef = useRef<HTMLDivElement>(null);

  // スクロールに合わせて岩と湯気をわずかに遅らせる(奥行き)
  useEffect(() => {
    const el = visualRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, window.innerHeight);
        el.style.setProperty("--u-parallax", `${y * 0.18}px`);
      });
    };
    // マウス位置に合わせて岩とロゴをわずかに傾ける(ポインタが精密な端末のみ)
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--u-tilt-x", `${x * 14}px`);
      el.style.setProperty("--u-tilt-y", `${y * 10}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <section className="u-hero-anim relative isolate overflow-hidden" aria-labelledby="hero-title">
      {/* 背景: 中央に向かって少しだけ明るくし、熱だまりを感じさせる */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 62%, rgba(242,241,235,0.38), transparent 70%), radial-gradient(40% 40% at 72% 80%, rgba(211,130,72,0.14), transparent 70%)",
        }}
      />

      <div className="u-container grid min-h-[100svh] grid-rows-[1fr_auto] pt-20 md:pt-24">
        <div className="grid items-center gap-y-6 lg:grid-cols-12 lg:gap-x-10">
          {/* ビジュアル */}
          <div
            ref={visualRef}
            className="relative order-1 mx-auto w-full max-w-[34rem] lg:order-2 lg:col-span-7 lg:max-w-none"
            style={{ transform: "translate3d(0, var(--u-parallax, 0px), 0)" }}
          >
            <div className="relative flex flex-col items-center">
              <div className="relative mt-1 w-full [translate:var(--u-tilt-x,0px)_var(--u-tilt-y,0px)] [transition:translate_1.4s_var(--u-ease)] sm:mt-5">
                {/* 湯気 */}
                <div className="pointer-events-none absolute inset-x-0 bottom-[38%] top-[-80%] z-10 overflow-visible" aria-hidden>
                  {STEAM.map((s, i) => (
                    <span
                      key={i}
                      className="absolute bottom-0 rounded-full bg-[#f7f6f1] blur-[48px] mix-blend-screen"
                      style={
                        {
                          left: s.left,
                          width: s.size,
                          height: s.size * 0.7,
                          marginLeft: -s.size / 2,
                          "--u-steam-x": `${s.x}px`,
                          "--u-steam-o": s.o,
                          animation: `u-steam ${s.dur}s linear ${s.delay}s infinite`,
                          opacity: 0,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
                <img
                  src="/brand/rock.webp"
                  alt="苔むした岩のイラスト"
                  width={986}
                  height={555}
                  {...{ fetchpriority: "high" }}
                  className="relative w-full select-none drop-shadow-[0_40px_40px_rgba(27,28,25,0.18)]"
                  style={{ animation: "u-fade-up 1.6s var(--u-ease) 0.5s both, u-float 9s ease-in-out 2.1s infinite" }}
                  draggable={false}
                />
                {/* 接地の影 */}
                <div
                  className="mx-auto -mt-3 h-6 w-[70%] rounded-[50%] bg-u-ink/25 blur-xl"
                  style={{ animation: "u-fade-up 1.6s var(--u-ease) 0.7s both" }}
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {/* コピー */}
          <div className="relative z-10 order-2 pb-6 lg:order-1 lg:col-span-5 lg:pb-0">
            <p className="u-eyebrow" style={{ animation: "u-fade-up 1.2s var(--u-ease) 0.4s both" }}>
              Private sauna · Umi, Fukuoka
            </p>
            <h1
              id="hero-title"
              className="u-mincho mt-6 whitespace-nowrap text-[clamp(2rem,4.4vw,3.75rem)] leading-[1.5] tracking-[0.08em]"
            >
              <span className="block overflow-hidden">
                <span className="block" style={{ animation: "u-rise 1.4s var(--u-ease) 0.55s both" }}>
                  圧倒的な
                </span>
              </span>
              <span className="block overflow-hidden">
                <span className="block" style={{ animation: "u-rise 1.4s var(--u-ease) 0.7s both" }}>
                  蒸気浴体験を
                </span>
              </span>
            </h1>
            <p
              className="mt-6 max-w-[26rem] text-[0.9375rem] leading-[2.1] text-u-ink/80"
              style={{ animation: "u-fade-up 1.2s var(--u-ease) 0.9s both" }}
            >
              福岡県宇美町の体験型サウナ「U」
              <br />
              最大6名、完全貸切のおもてなしサウナ
            </p>
            <Link
              to="/kodawari"
              className="group mt-5 inline-flex items-center gap-3 text-[0.8125rem] tracking-[0.12em]"
              style={{ animation: "u-fade-up 1.2s var(--u-ease) 0.95s both" }}
            >
              <span className="text-u-ink/80">こだわりのサウナ体験</span>
              <span className="u-link">詳細をみる</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden />
            </Link>
            <div
              className="mt-9 flex flex-wrap items-center gap-3"
              style={{ animation: "u-fade-up 1.2s var(--u-ease) 1.05s both" }}
            >
              <a href="#reserve" className="u-btn u-btn-primary">
                貸切サウナ予約
                <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
              </a>
              <Link to="/events" className="u-btn u-btn-ghost">
                パブリックイベント予約
              </Link>
            </div>
          </div>
        </div>

        {/* 下部: 要点 + スクロール誘導 */}
        <div
          className="relative z-10 flex items-end justify-between gap-6 border-t border-u-ink/15 py-5 md:py-6"
          style={{ animation: "u-fade-up 1.2s var(--u-ease) 1.2s both" }}
        >
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.k} className="flex flex-col">
                <dt className="u-latin text-xs italic text-u-ink/80">{f.k}</dt>
                <dd className="text-sm tracking-[0.12em]">{f.v}</dd>
              </div>
            ))}
          </dl>
          <a href="#reserve" className="hidden flex-col items-center gap-2 text-u-ink/80 md:flex" aria-label="予約フォームへ">
            <span className="u-latin text-xs italic">Scroll</span>
            <span className="relative block h-10 w-px overflow-hidden bg-u-ink/15">
              <span className="absolute inset-0 bg-u-ink" style={{ animation: "u-scroll-cue 2.4s var(--u-ease-in-out) infinite" }} />
            </span>
            <ArrowDown className="sr-only" />
          </a>
        </div>
      </div>
    </section>
  );
};
