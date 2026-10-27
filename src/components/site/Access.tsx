import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const MAP_URL = "https://g.co/kgs/9f4Eqdv";
const EMBED_URL = "https://www.google.com/maps?q=" + encodeURIComponent("福岡県糟屋郡宇美町障子岳6-8-4") + "&z=14&output=embed";

export const Access = () => (
  <section id="access" className="scroll-mt-16 py-24 md:py-36" aria-labelledby="access-title">
    <div className="u-container">
      <SectionHeading index="06" latin="Access" title={<span id="access-title">アクセス</span>} />
      <div className="mt-14 grid gap-10 md:mt-20 lg:grid-cols-12 lg:gap-12">
        <Reveal className="relative overflow-hidden rounded-[1.5rem] bg-u-mist-deep lg:col-span-7">
          <iframe
            title="U sauna の地図"
            src={EMBED_URL}
            className="aspect-[4/3] w-full border-0 [filter:grayscale(1)_sepia(.25)_contrast(.95)_brightness(1.02)] lg:aspect-auto lg:h-full lg:min-h-[28rem]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <span className="pointer-events-none absolute inset-0 rounded-[1.5rem] ring-1 ring-inset ring-u-ink/10" aria-hidden />
        </Reveal>
        <div className="lg:col-span-5">
          <Reveal>
            <p className="u-latin text-sm italic text-u-ink/80">Address</p>
            <address className="mt-2 not-italic">
              <span className="u-num text-sm text-u-ink/80">〒811-2127</span>
              <span className="u-display mt-1 block text-[1.375rem] leading-[1.7] tracking-[0.08em]">
                福岡県糟屋郡宇美町
                <br />
                障子岳6-8-4
              </span>
            </address>
            <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="u-btn u-btn-ghost mt-6">
              Google マップで開く
              <ArrowUpRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
            </a>
          </Reveal>
          <dl className="mt-12 space-y-0">
            {[
              { k: "Car", t: "お車で", v: "福岡空港から約30分\n交通状況によってはそれ以上かかることがあります" },
              { k: "Train & Bus", t: "電車・バスで", v: "JR香椎線「宇美駅」からバスで約20分" },
            ].map((r, i) => (
              <Reveal key={r.k} delay={120 + i * 80} className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-u-ink/15 py-5">
                <dt>
                  <span className="block text-sm tracking-[0.12em]">{r.t}</span>
                  <span className="u-latin text-xs italic text-u-ink/80">{r.k}</span>
                </dt>
                <dd className="text-sm leading-[2] text-u-ink/80">{r.v}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </div>
  </section>
);
