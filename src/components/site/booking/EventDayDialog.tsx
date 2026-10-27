import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface EventDay {
  date: Date;
  slug: string;
  title: string;
}

// 予約カレンダーでパブリックイベント日を押したときの案内。貸切はお休みなので、イベントのページへ案内する
export const EventDayDialog = ({ eventDay, onClose }: { eventDay: EventDay | null; onClose: () => void }) => (
  <Dialog open={!!eventDay} onOpenChange={(open) => !open && onClose()}>
    <DialogContent
      overlayClassName="bg-u-ink/50 backdrop-blur-sm"
      className="u-site w-[calc(100%-1.5rem)] max-w-md gap-0 overflow-hidden rounded-[1.75rem] border-0 bg-u-paper p-0 shadow-[0_40px_120px_-30px_rgba(35,31,32,0.6)] sm:rounded-[1.75rem] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-transparent [&>button]:text-u-paper [&>button[data-state=open]]:bg-transparent [&>button:hover]:bg-u-paper/10 [&>button:focus]:ring-0 [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-u-paper/40 [&>button:focus-visible]:ring-offset-0"
    >
      {eventDay && (
        <>
          <div className="relative overflow-hidden bg-u-green px-6 pb-7 pt-8 text-u-paper sm:px-8">
            <div
              className="u-halftone pointer-events-none absolute inset-0 text-u-mist/30"
              style={{
                maskImage: "linear-gradient(to left, #000, transparent 70%)",
                WebkitMaskImage: "linear-gradient(to left, #000, transparent 70%)",
              }}
              aria-hidden
            />
            <DialogHeader className="relative space-y-0 text-left">
              <p className="u-latin text-sm italic text-u-paper/75">Public event</p>
              <p className="u-num mt-4 text-sm tracking-[0.12em] text-u-paper/80">
                {format(eventDay.date, "yyyy.M.d")}
                <span className="ml-2 text-xs">{format(eventDay.date, "(E)", { locale: ja })}</span>
              </p>
              <DialogTitle className="u-display mt-2 text-xl font-medium leading-[1.6] tracking-[0.1em]">{eventDay.title}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 sm:p-8">
            <DialogDescription className="text-sm leading-[2] text-u-ink/80">
              {"この日はパブリックイベントの開催日のため、貸切サウナのご予約はお休みです\nイベントへのご参加は、イベントのページからご予約いただけます"}
            </DialogDescription>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
              <Link to={`/events/${eventDay.slug}`} className="u-btn u-btn-primary">
                イベントを見る
                <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
              </Link>
              <button type="button" onClick={onClose} className="u-btn u-btn-ghost">
                ほかの日を選ぶ
              </button>
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);
