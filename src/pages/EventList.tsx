import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEventList } from "@/hooks/useEvent";
import { formatEventDateLabel } from "@/utils/eventFormat";
import { SiteShell, PageHero } from "@/components/site/SiteShell";
import { Reveal } from "@/components/site/Reveal";

/** 公開中のパブリックイベント一覧 */
const EventList = () => {
  const { data: events, isLoading } = useEventList();

  return (
    <SiteShell>
      <PageHero latin="Public Events" title="パブリックサウナイベントのご予約" />

      <div className="u-container pb-24 md:pb-36">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-[1.5rem] bg-u-ink/[0.06]" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="flex flex-col items-center rounded-[1.5rem] border border-dashed border-u-ink/20 px-6 py-20 text-center">
            <span className="u-mark w-12 text-u-ink/25" aria-hidden />
            <p className="u-mincho mt-8 text-xl tracking-[0.1em]">現在受付中のイベントはありません</p>
            <p className="mt-3 text-sm text-u-ink/80">次回の開催をお楽しみに</p>
            <Link to="/" className="u-btn u-btn-ghost mt-8">
              貸切のご予約はこちら
            </Link>
          </div>
        ) : (
          <ul className="border-t border-u-ink/15">
            {events.map((event, i) => {
              const dates = Array.from(new Set(event.event_slots.map((slot) => slot.date))).sort();
              return (
                <Reveal as="li" key={event.slug} delay={i * 80} className="border-b border-u-ink/15">
                  <Link
                    to={`/events/${event.slug}`}
                    className="group grid gap-6 py-10 transition-colors md:grid-cols-12 md:items-center md:gap-8 md:py-14"
                  >
                    <span className="u-num text-sm text-u-ink/80 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                    <div className="md:col-span-7">
                      <h2 className="u-mincho text-[clamp(1.375rem,3vw,2rem)] leading-[1.5] tracking-[0.08em] transition-transform duration-700 [transition-timing-function:var(--u-ease)] group-hover:translate-x-2">
                        {event.title}
                      </h2>
                      {event.description && (
                        <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-[2] text-u-ink/80">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <dl className="space-y-2 text-sm md:col-span-3">
                      {dates.length > 0 && (
                        <div className="flex gap-4">
                          <dt className="w-12 shrink-0 text-xs tracking-[0.14em] text-u-ink/80">開催日</dt>
                          <dd>
                            {formatEventDateLabel(dates[0])}
                            {dates.length > 1 && <span className="text-u-ink/80"> ほか{dates.length - 1}日程</span>}
                          </dd>
                        </div>
                      )}
                      {event.venue && (
                        <div className="flex gap-4">
                          <dt className="w-12 shrink-0 text-xs tracking-[0.14em] text-u-ink/80">会場</dt>
                          <dd>{event.venue}</dd>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <dt className="w-12 shrink-0 text-xs tracking-[0.14em] text-u-ink/80">料金</dt>
                        <dd>
                          {event.price_per_person > 0 ? (
                            <>
                              お一人様 <span className="u-num text-base">¥{event.price_per_person.toLocaleString()}</span>
                            </>
                          ) : (
                            event.price_note || "無料"
                          )}
                        </dd>
                      </div>
                    </dl>
                    <span className="flex items-center gap-3 md:col-span-1 md:justify-end">
                      <span className="text-xs tracking-[0.14em] md:sr-only">詳細・ご予約はこちら</span>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-u-ink/25 transition-all duration-500 group-hover:bg-u-ink group-hover:text-u-paper">
                        <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-45" strokeWidth={1.4} />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        )}
      </div>
    </SiteShell>
  );
};

export default EventList;
