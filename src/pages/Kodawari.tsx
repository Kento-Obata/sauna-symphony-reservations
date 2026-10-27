import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { Reveal, useInView } from "@/components/site/Reveal";
import { KodawariVisual } from "@/components/site/kodawari/KodawariVisual";
import { KODAWARI, pad, type KodawariItem } from "@/components/site/kodawari/data";
import { cn } from "@/lib/utils";

const PAGE_TITLE = "こだわり — 体験型サウナU";

// 横長の写真の章だけ、写真を左右交互に置く
const FLIPPED = new Set(
  KODAWARI.filter((k) => k.layout === "landscape")
    .filter((_, i) => i % 2 === 0)
    .map((k) => k.no)
);

// 写真を下から幕が開くように出す
const PhotoReveal = ({ className, children }: { className?: string; children: ReactNode }) => {
  const ref = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("u-photo-reveal", className)}>
      <div className="h-full w-full overflow-hidden rounded-[1.25rem] bg-u-ink-2">{children}</div>
    </div>
  );
};

const Figure = ({ figure }: { figure: NonNullable<KodawariItem["figure"]> }) => (
  <div className="mt-10 flex items-end gap-5 border-t border-u-paper/15 pt-6">
    <p className="u-latin flex items-baseline leading-none text-u-mist">
      <span className="text-[clamp(3.5rem,7vw,5.5rem)] font-light">{figure.value}</span>
      <span className="ml-1 text-2xl">{figure.unit}</span>
    </p>
    <p className="pb-2 text-xs tracking-[0.14em] text-u-paper/60">{figure.caption}</p>
  </div>
);

const ChapterText = ({ item, className }: { item: KodawariItem; className?: string }) => (
  <div className={className}>
    <Reveal>
      <div className="flex items-baseline gap-4">
        <span className="u-latin text-[clamp(3rem,6vw,4.5rem)] font-light italic leading-none text-u-mist">{pad(item.no)}</span>
        <span className="u-latin text-base italic text-u-paper/60">{item.latin}</span>
      </div>
    </Reveal>
    <Reveal delay={100}>
      <h2 className="u-display mt-6 text-[clamp(1.5rem,2.8vw,2.25rem)] leading-[1.5] tracking-[0.1em]">{item.title}</h2>
    </Reveal>
    <Reveal delay={180}>
      <p className="mt-6 max-w-[34rem] text-[0.9375rem] leading-[2.15] text-u-paper/75">{item.body}</p>
      {item.figure && <Figure figure={item.figure} />}
    </Reveal>
  </div>
);

const Chapter = ({ item, flip }: { item: KodawariItem; flip: boolean }) => {
  const sizes = item.layout === "wide" ? "100vw" : item.layout === "portrait" ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 58vw, 100vw";

  if (item.layout === "wide") {
    return (
      <section id={item.slug} data-chapter={item.no} className="scroll-mt-28 py-20 md:scroll-mt-32 md:py-32" aria-label={item.title}>
        <div className="u-container">
          <PhotoReveal className="aspect-[4/3] md:aspect-[21/9]">
            <KodawariVisual item={item} sizes={sizes} />
          </PhotoReveal>
          <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12">
            <ChapterText item={item} className="lg:col-span-7 lg:col-start-6" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={item.slug} data-chapter={item.no} className="scroll-mt-28 py-20 md:scroll-mt-32 md:py-32" aria-label={item.title}>
      <div className="u-container grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <PhotoReveal
          className={cn(
            item.layout === "portrait" ? "aspect-[4/5] lg:col-span-5" : "aspect-[4/3] lg:col-span-7",
            flip && "lg:order-2"
          )}
        >
          <KodawariVisual item={item} sizes={sizes} />
        </PhotoReveal>
        <ChapterText
          item={item}
          className={cn(item.layout === "portrait" ? "lg:col-span-6 lg:col-start-7" : "lg:col-span-5", flip && "lg:order-1")}
        />
      </div>
    </section>
  );
};

// スクロール中の位置を示すバー(何番目のこだわりを読んでいるか)
const ChapterBar = ({ active }: { active: number }) => {
  const item = KODAWARI.find((k) => k.no === active);
  return (
    <div
      className={cn(
        "fixed inset-x-0 top-16 z-40 border-b border-u-paper/10 bg-u-ink/85 text-u-paper backdrop-blur-xl transition-[transform,opacity] duration-500 md:top-[4.5rem]",
        item ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      )}
      aria-hidden
    >
      <div className="u-container flex h-11 items-center gap-4">
        <span className="u-num text-xs text-u-paper/60">
          {pad(active || 1)} / {pad(KODAWARI.length)}
        </span>
        <span className="u-display truncate text-sm tracking-[0.12em]">{item?.title}</span>
        <span className="ml-auto hidden gap-1 sm:flex">
          {KODAWARI.map((k) => (
            <span key={k.no} className={cn("h-px w-6 transition-colors duration-500", k.no <= active ? "bg-u-mist" : "bg-u-paper/20")} />
          ))}
        </span>
      </div>
    </div>
  );
};

const Kodawari = () => {
  const [active, setActive] = useState(0);
  const chaptersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const root = chaptersRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"));
    // 画面の中央を通っている章を「いま読んでいる章」にする
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chapter));
        });
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    // 章の範囲から出たらバーを隠す
    const outer = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) setActive(0);
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    outer.observe(root);
    return () => {
      io.disconnect();
      outer.disconnect();
    };
  }, []);

  return (
    <SiteShell minimalFooter className="!pt-0">
      <ChapterBar active={active} />

      {/* 導入 */}
      <header className="relative overflow-hidden pb-24 pt-32 md:pb-36 md:pt-44">
        {/* 下端の網点の帯(ブランドガイドのモチーフ)。下の暗い章へ霧のようにつなぐ */}
        <div
          className="u-halftone pointer-events-none absolute inset-x-0 bottom-0 h-20 text-u-ink/30 md:h-28"
          style={{
            maskImage: "linear-gradient(to top, #000, transparent)",
            WebkitMaskImage: "linear-gradient(to top, #000, transparent)",
          }}
          aria-hidden
        />
        <div className="u-container grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="u-eyebrow" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
              Craft · {KODAWARI.length} elements
            </p>
            <h1
              className="u-display mt-6 text-[clamp(2rem,5vw,3.75rem)] leading-[1.45] tracking-[0.08em]"
              style={{ animation: "u-fade-up 1.2s var(--u-ease) .1s both" }}
            >
              体験型サウナ U の
              <br />
              こだわり
            </h1>
          </div>
          <div className="lg:col-span-5 lg:pb-3" style={{ animation: "u-fade-up 1.2s var(--u-ease) .2s both" }}>
            <p className="max-w-md text-[0.9375rem] leading-[2.1] text-u-ink/80">
              過熱水蒸気と飽和水蒸気、石の積み方、火の入れ方、水と木<br />ひとつの蒸気浴体験を形づくる、{KODAWARI.length}つの要素をご紹介します
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/#reserve" className="u-btn u-btn-primary">
                貸切サウナ予約
                <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* こだわりの各章 */}
      <div ref={chaptersRef} className="bg-u-ink text-u-paper">
        {KODAWARI.map((item) => (
          <Chapter key={item.slug} item={item} flip={FLIPPED.has(item.no)} />
        ))}
      </div>

      {/* 予約へ */}
      <section className="bg-u-paper py-24 md:py-36" aria-labelledby="kodawari-reserve">
        <div className="u-container flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="u-eyebrow">Reserve</p>
            <h2 id="kodawari-reserve" className="u-display mt-5 text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.5] tracking-[0.08em]">
              150分、完全貸切で
            </h2>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-[2] text-u-ink/70">
              最大6名・手ぶらでお越しいただけます<br />空き状況と料金は、予約フォームでその場で確認できます
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/#reserve" className="u-btn u-btn-primary">
              貸切サウナ予約
              <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Link to="/#hours" className="u-btn u-btn-ghost">
              営業時間・料金
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
};

export default Kodawari;
