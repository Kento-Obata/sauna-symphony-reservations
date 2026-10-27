import { Link, useParams } from "react-router-dom";
import { useEvent } from "@/hooks/useEvent";
import { useEventReservationForm } from "@/hooks/useEventReservationForm";
import { EventSlotPicker } from "@/components/events/EventSlotPicker";
import { EventReservationForm } from "@/components/events/EventReservationForm";
import { SiteShell } from "@/components/site/SiteShell";
import { Step } from "@/components/site/booking/Step";

/** イベント予約特設ページ（/events/:slug） */
const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useEvent(slug);
  const form = useEventReservationForm(data?.event, data?.slots ?? []);

  return (
    <SiteShell>
      {isLoading ? (
        <div className="u-container py-16 md:py-24">
          <div className="h-16 w-2/3 animate-pulse rounded-xl bg-u-ink/[0.07]" />
          <div className="mt-6 h-5 w-1/2 animate-pulse rounded bg-u-ink/[0.05]" />
          <div className="mt-16 h-80 animate-pulse rounded-[1.5rem] bg-u-ink/[0.05]" />
        </div>
      ) : error || !data ? (
        <div className="u-container flex flex-col items-center py-24 text-center">
          <span className="u-mark w-12 text-u-ink/25" aria-hidden />
          <h1 className="u-display mt-8 text-2xl tracking-[0.1em]">イベントが見つかりません</h1>
          <p className="mt-3 text-sm text-u-ink/70">公開が終了したか、URLが間違っている可能性があります</p>
          <Link to="/events" className="u-btn u-btn-ghost mt-8">
            イベント一覧へ
          </Link>
        </div>
      ) : (
        <>
          <header className="u-container pb-12 pt-14 md:pb-20 md:pt-24">
            <Link
              to="/events"
              className="u-latin text-base italic text-u-ink/70 transition-colors hover:text-u-ink"
              style={{ animation: "u-fade-up 1s var(--u-ease) both" }}
            >
              ← Public Events
            </Link>
            <h1
              className="u-display mt-6 max-w-4xl text-[clamp(1.75rem,4.4vw,3.25rem)] leading-[1.5] tracking-[0.08em]"
              style={{ animation: "u-fade-up 1s var(--u-ease) .1s both" }}
            >
              {data.event.title}
            </h1>
            <div className="mt-10 grid gap-10 md:grid-cols-12" style={{ animation: "u-fade-up 1s var(--u-ease) .2s both" }}>
              {data.event.description && (
                <p className="whitespace-pre-line text-[0.9375rem] leading-[2.1] text-u-ink/75 md:col-span-7">
                  {data.event.description}
                </p>
              )}
              <dl className="border-t border-u-ink/20 md:col-span-5 md:col-start-8">
                {data.event.venue && (
                  <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-u-ink/10 py-4 text-sm">
                    <dt className="text-xs tracking-[0.14em] text-u-ink/65">会場</dt>
                    <dd>{data.event.venue}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-u-ink/10 py-4 text-sm">
                  <dt className="text-xs tracking-[0.14em] text-u-ink/65">料金</dt>
                  <dd>
                    {data.event.price_per_person > 0 ? (
                      <>
                        お一人様 <span className="u-num text-xl">¥{data.event.price_per_person.toLocaleString()}</span>
                        <span className="text-u-ink/70">
                          {data.event.payment_type === "prepaid"
                            ? "（事前決済）"
                            : data.event.price_note
                              ? `（${data.event.price_note}）`
                              : "（当日現地払い）"}
                        </span>
                      </>
                    ) : (
                      data.event.price_note || "無料"
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-u-ink/10 py-4 text-sm">
                  <dt className="text-xs tracking-[0.14em] text-u-ink/65">人数</dt>
                  <dd>1回のご予約につき{data.event.max_guests_per_reservation}名まで</dd>
                </div>
              </dl>
            </div>
          </header>

          <section className="bg-u-paper py-16 md:py-24" aria-label="イベントのご予約">
            <div className="u-container max-w-3xl">
              <Step id="event-step-slot" index={1} title="枠を選択" done={!!form.selectedSlotId}>
                <EventSlotPicker
                  slots={data.slots}
                  selectedSlotId={form.selectedSlotId}
                  onSelect={(slotId) => {
                    form.setSelectedSlotId(slotId);
                    form.setPeople("");
                  }}
                />
              </Step>
              <Step id="event-step-info" index={2} title="お客様情報">
                <EventReservationForm event={data.event} form={form} />
              </Step>
            </div>
          </section>
        </>
      )}
    </SiteShell>
  );
};

export default EventPage;
