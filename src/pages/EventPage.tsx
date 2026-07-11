import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { useEvent } from "@/hooks/useEvent";
import { useEventReservationForm } from "@/hooks/useEventReservationForm";
import { EventSlotPicker } from "@/components/events/EventSlotPicker";
import { EventReservationForm } from "@/components/events/EventReservationForm";

/** イベント予約特設ページ（/events/:slug） */
const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useEvent(slug);
  const form = useEventReservationForm(data?.event, data?.slots ?? []);

  return (
    <div className="min-h-screen flex flex-col bg-sauna-base">
      <Header />
      <div className="max-w-4xl mx-auto w-full px-4 py-12 flex-1">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-pulse h-4 w-32 bg-sauna-stone/10 rounded"></div>
          </div>
        ) : error || !data ? (
          <div className="glass-card p-10 text-center space-y-4">
            <p className="font-mplus font-light text-black">イベントが見つかりません</p>
            <p className="text-sm font-mplus font-extralight text-black/60">
              公開が終了したか、URLが間違っている可能性があります。
            </p>
            <Link
              to="/events"
              className="inline-block text-sm font-mplus font-extralight text-black underline underline-offset-4 decoration-black/30"
            >
              イベント一覧へ →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="glass-card p-8 text-center space-y-4">
              <h1 className="text-2xl sm:text-3xl font-mplus font-thin text-gradient">
                {data.event.title}
              </h1>
              {data.event.description && (
                <p className="text-sm font-mplus font-extralight text-black/80 whitespace-pre-line text-left sm:text-center">
                  {data.event.description}
                </p>
              )}
              <div className="text-sm font-mplus font-extralight text-black/70 space-y-1">
                {data.event.venue && <p>会場: {data.event.venue}</p>}
                <p>
                  料金:{" "}
                  {data.event.price_per_person > 0
                    ? `お一人様 ¥${data.event.price_per_person.toLocaleString()}${
                      data.event.payment_type === "prepaid"
                        ? "（事前決済）"
                        : data.event.price_note ? `（${data.event.price_note}）` : "（当日現地払い）"
                    }`
                    : data.event.price_note || "無料"}
                </p>
                <p>1回のご予約につき{data.event.max_guests_per_reservation}名まで</p>
              </div>
            </div>

            <div className="glass-card p-8">
              <h2 className="text-lg font-mplus font-light text-black text-center mb-6">
                枠を選択
              </h2>
              <EventSlotPicker
                slots={data.slots}
                selectedSlotId={form.selectedSlotId}
                onSelect={(slotId) => {
                  form.setSelectedSlotId(slotId);
                  form.setPeople("");
                }}
              />
            </div>

            <div className="glass-card p-8">
              <h2 className="text-lg font-mplus font-light text-black text-center mb-6">
                お客様情報
              </h2>
              <EventReservationForm event={data.event} form={form} />
            </div>
          </div>
        )}
      </div>

      <footer className="mt-auto py-8 px-4 border-t border-sauna-stone/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-sauna-stone/70">
            © 2024 株式会社sync All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default EventPage;
