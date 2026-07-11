import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useEventList } from "@/hooks/useEvent";
import { formatEventDateLabel } from "@/utils/eventFormat";

/** 公開中のパブリックイベント一覧 */
const EventList = () => {
  const { data: events, isLoading } = useEventList();

  return (
    <div className="min-h-screen flex flex-col bg-sauna-base">
      <Header />
      <div className="max-w-4xl mx-auto w-full px-4 py-12 flex-1">
        <h1 className="text-3xl font-mplus font-thin text-center text-gradient mb-2">
          Public Events
        </h1>
        <p className="text-center text-sm font-mplus font-extralight text-black/70 mb-10">
          パブリックサウナイベントのご予約
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-pulse h-4 w-32 bg-sauna-stone/10 rounded"></div>
          </div>
        ) : !events || events.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="font-mplus font-extralight text-black/70">
              現在受付中のイベントはありません。
            </p>
            <p className="text-sm font-mplus font-extralight text-black/50 mt-2">
              次回の開催をお楽しみに。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => {
              const dates = Array.from(new Set(event.event_slots.map((slot) => slot.date))).sort();
              return (
                <Link
                  key={event.slug}
                  to={`/events/${event.slug}`}
                  className="block glass-card p-6 hover-lift"
                >
                  <h2 className="text-xl font-mplus font-light text-black mb-2">
                    {event.title}
                  </h2>
                  {event.description && (
                    <p className="text-sm font-mplus font-extralight text-black/70 mb-3 whitespace-pre-line line-clamp-3">
                      {event.description}
                    </p>
                  )}
                  <div className="text-sm font-mplus font-extralight text-black/60 space-y-1">
                    {dates.length > 0 && (
                      <p>
                        開催日: {formatEventDateLabel(dates[0])}
                        {dates.length > 1 && ` ほか${dates.length - 1}日程`}
                      </p>
                    )}
                    {event.venue && <p>会場: {event.venue}</p>}
                    <p>
                      料金:{" "}
                      {event.price_per_person > 0
                        ? `お一人様 ¥${event.price_per_person.toLocaleString()}`
                        : event.price_note || "無料"}
                    </p>
                  </div>
                  <p className="text-sm font-mplus font-extralight text-black underline underline-offset-4 decoration-black/30 mt-4">
                    詳細・ご予約はこちら →
                  </p>
                </Link>
              );
            })}
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

export default EventList;
