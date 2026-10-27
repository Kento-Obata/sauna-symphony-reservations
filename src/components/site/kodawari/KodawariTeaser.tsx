import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "../SectionHeading";
import { Reveal } from "../Reveal";
import { KodawariVisual } from "./KodawariVisual";
import { KODAWARI, pad } from "./data";

// トップの「こだわり」: 8項目をカードで一覧し、詳しくは /kodawari へ。
// スマホは横スクロールにして、予約以降の情報まで縦に長くしない
export const KodawariTeaser = () => (
  <section id="craft" className="relative scroll-mt-16 overflow-hidden bg-u-ink py-24 text-u-paper md:py-36" aria-labelledby="craft-title">
    <div className="u-container">
      <SectionHeading
        tone="light"
        index="02"
        latin="Craft"
        title={<span id="craft-title">体験型サウナ U のこだわり</span>}
        lead="ふたつの蒸気、石の積み方、火の入れ方、水と木。ひとつの蒸気浴体験を形づくる、8つの要素です"
      />
    </div>

    <ol
      className="mt-14 flex snap-x snap-mandatory scroll-px-[var(--u-gutter)] gap-3 overflow-x-auto px-[var(--u-gutter)] pb-2 [scrollbar-width:none] md:mx-auto md:mt-20 md:grid md:max-w-[82rem] md:grid-cols-4 md:gap-4 md:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-label="8つのこだわり"
    >
      {KODAWARI.map((item, i) => (
        <Reveal as="li" key={item.slug} delay={(i % 4) * 90} className="w-[72vw] max-w-[20rem] shrink-0 snap-start md:w-auto md:max-w-none">
          <Link
            to={`/kodawari#${item.slug}`}
            className="group relative block aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-u-ink-2 focus-visible:outline-offset-4"
          >
            <KodawariVisual
              item={item}
              sizes="(min-width: 768px) 25vw, 72vw"
              className="transition-transform duration-[1.4s] [transition-timing-function:var(--u-ease)] group-hover:scale-[1.06]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />
            <span className="u-num absolute left-5 top-4 text-sm text-white/85">{pad(item.no)}</span>
            <div className="absolute inset-x-5 bottom-5">
              <p className="u-latin text-sm italic text-white/75">{item.latin}</p>
              <h3 className="mt-1 flex items-end justify-between gap-3">
                <span className="u-mincho text-lg leading-[1.5] tracking-[0.1em] text-white sm:text-xl">{item.title}</span>
                <ArrowRight
                  className="mb-1 h-4 w-4 shrink-0 text-white/80 transition-transform duration-500 group-hover:-rotate-45"
                  strokeWidth={1.4}
                  aria-hidden
                />
              </h3>
            </div>
          </Link>
        </Reveal>
      ))}
    </ol>

    <div className="u-container mt-10 flex flex-wrap items-center justify-between gap-4 md:mt-14">
      <p className="text-xs tracking-[0.12em] text-u-paper/60 md:hidden">横にスクロールして8項目を見る</p>
      <Link to="/kodawari" className="u-btn u-btn-light md:ml-auto">
        こだわりを詳しく見る
        <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
      </Link>
    </div>
  </section>
);
