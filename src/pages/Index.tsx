import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import ReservationForm from "@/components/ReservationForm";
import { SiteNav } from "@/components/site/SiteNav";
import { Hero } from "@/components/site/Hero";
import { SectionHeading } from "@/components/site/SectionHeading";
import { HoursPrice } from "@/components/site/HoursPrice";
import { Guide } from "@/components/site/Guide";
import { Amenities } from "@/components/site/Amenities";
import { Access } from "@/components/site/Access";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { IntroCurtain } from "@/components/site/IntroCurtain";
import { useState } from "react";
import { KodawariTeaser } from "@/components/site/kodawari/KodawariTeaser";
import { useHashScroll } from "@/hooks/useHashScroll";

const Index = () => {
  const [introDone, setIntroDone] = useState(false);
  useHashScroll();
  return (
    <div
      className={`u-site u-grain min-h-screen ${introDone ? "" : "u-intro-hold"}`}
    >
      <IntroCurtain onLift={() => setIntroDone(true)} />
      <a
        href="#reserve"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-u-ink focus:px-4 focus:py-2 focus:text-u-paper"
      >
        予約フォームへスキップ
      </a>
      <SiteNav />
      <main>
        <Hero />

        <section
          id="reserve"
          className="scroll-mt-16 bg-u-paper pb-32 pt-20 md:py-32"
          aria-labelledby="reserve-title"
        >
          <div className="u-container">
            <SectionHeading
              index="01"
              latin="Reserve"
              title={<span id="reserve-title">ご予約</span>}
            />
            <Reveal className="mt-12 md:mt-20">
              <ReservationForm />
            </Reveal>
          </div>
        </section>

        <KodawariTeaser />
        <HoursPrice />
        <Amenities />
        <Guide />
        <Access />

        <section className="border-t border-u-ink/15">
          <Link to="/events" className="group block">
            <div className="u-container flex flex-col items-start justify-between gap-6 py-16 md:flex-row md:items-center md:py-24">
              <div>
                <p className="u-eyebrow">Public sauna event</p>
                <p className="u-mincho mt-4 text-[clamp(1.5rem,3.4vw,2.5rem)] leading-[1.5] tracking-[0.08em]">
                  パブリックサウナイベントの
                  <br className="sm:hidden" />
                  ご予約はこちら
                </p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-u-ink/25 transition-all duration-500 group-hover:scale-110 group-hover:bg-u-ink group-hover:text-u-paper md:h-24 md:w-24">
                <ArrowRight
                  className="h-6 w-6 transition-transform duration-500 group-hover:-rotate-45"
                  strokeWidth={1.2}
                />
              </span>
            </div>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;
