import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getJstTodayYmd } from "@/utils/jstDate";
import { getMaxSlotsForDate } from "@/utils/timeSlotRules";
import { isHoliday } from "@/utils/holidayUtils";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";
import { EventDayDialog, type EventDay } from "./EventDayDialog";

type Availability = Pick<Reservation, "date" | "time_slot" | "status">;
type DayState =
  | { kind: "past" }
  | { kind: "out" }
  | { kind: "closed" }
  | { kind: "event"; slug: string; title: string }
  | { kind: "full" }
  | { kind: "open"; remaining: number; max: number };

interface BookingCalendarProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  reservations: Availability[] | undefined;
  closedDates: Set<string>;
  /** パブリックイベント日(公開中のイベントが紐づく休業日) */
  eventDays?: Map<string, { slug: string; title: string }>;
  dailyTimeSlots: Parameters<typeof getMaxSlotsForDate>[1];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const BookingCalendar = ({ value, onChange, reservations, closedDates, eventDays, dailyTimeSlots }: BookingCalendarProps) => {
  const [eventDay, setEventDay] = useState<EventDay | null>(null);
  const today = useMemo(() => new Date(), []);
  // 予約受付は3か月先まで(既存仕様)
  const limit = useMemo(() => addMonths(today, 3), [today]);
  const [month, setMonth] = useState(() => startOfMonth(value ?? today));
  const todayYmd = getJstTodayYmd();

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    reservations?.forEach((r) => {
      if (r.status === "confirmed" || r.status === "pending") m.set(r.date, (m.get(r.date) ?? 0) + 1);
    });
    return m;
  }, [reservations]);

  const getState = (day: Date): DayState => {
    const ymd = format(day, "yyyy-MM-dd");
    // 当日以前はフォームでは受け付けない(当日予約は Instagram DM)
    if (ymd <= todayYmd) return { kind: "past" };
    if (isAfter(day, limit)) return { kind: "out" };
    const event = eventDays?.get(ymd);
    if (event) return { kind: "event", ...event };
    if (closedDates.has(ymd)) return { kind: "closed" };
    const max = getMaxSlotsForDate(day, dailyTimeSlots ?? []);
    const count = countByDate.get(ymd) ?? 0;
    if (count >= max) return { kind: "full" };
    return { kind: "open", remaining: max - count, max };
  };

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leading = getDay(days[0]);
  const canPrev = isAfter(month, startOfMonth(today));
  const canNext = !isAfter(addMonths(month, 1), limit);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3" aria-live="polite">
          <span className="u-num text-[2.5rem] font-light leading-none">{format(month, "M")}</span>
          <span className="flex flex-col leading-tight">
            <span className="u-latin text-sm italic text-u-ink/70">{format(month, "MMMM")}</span>
            <span className="text-xs tracking-[0.2em] text-u-ink/70">{format(month, "yyyy")}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            disabled={!canPrev}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-u-ink/15 transition-colors hover:border-u-ink hover:bg-u-ink hover:text-u-paper disabled:pointer-events-none disabled:opacity-30"
            aria-label="前の月"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={!canNext}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-u-ink/15 transition-colors hover:border-u-ink hover:bg-u-ink hover:text-u-paper disabled:pointer-events-none disabled:opacity-30"
            aria-label="次の月"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div role="group" aria-label={`${format(month, "yyyy年M月")}のカレンダー`}>
        <div className="grid grid-cols-7 border-b border-u-ink/10 pb-2" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn("text-center text-[0.6875rem] tracking-[0.2em] text-u-ink/65", i === 0 && "text-u-wood")}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1" key={month.toISOString()} style={{ animation: "u-fade-up .6s var(--u-ease) both" }}>
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`pad-${i}`} aria-hidden />
          ))}
          {days.map((day) => {
            const state = getState(day);
            const selectable = state.kind === "open";
            const selected = !!value && isSameDay(day, value) && isSameMonth(day, month);
            const red = getDay(day) === 0 || isHoliday(day);
            const label = `${format(day, "M月d日")} ${
              state.kind === "open"
                ? `空きあり 残り${state.remaining}枠`
                : state.kind === "full"
                ? "満席"
                : state.kind === "closed"
                ? "休業日"
                : state.kind === "event"
                ? `パブリックイベント「${state.title}」開催日`
                : "予約受付外"
            }`;
            return (
              <button
                key={day.toISOString()}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                disabled={!selectable && state.kind !== "event"}
                onClick={() =>
                  state.kind === "event" ? setEventDay({ date: day, slug: state.slug, title: state.title }) : onChange(day)
                }
                className={cn(
                  "group relative flex h-[3.25rem] flex-col items-center justify-center rounded-xl transition-all duration-300 sm:h-16",
                  selectable && !selected && "hover:bg-u-ink/[0.06]",
                  state.kind === "event" && "hover:bg-u-green/10",
                  selected && "bg-u-ink text-u-paper shadow-[0_10px_30px_-10px_rgba(35,31,32,0.6)]",
                  !selectable && state.kind !== "event" && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "u-num text-[1.0625rem] leading-none sm:text-xl",
                    !selectable && state.kind !== "event" && "text-u-ink/25",
                    state.kind === "event" && "text-u-green",
                    selectable && red && !selected && "text-u-wood"
                  )}
                >
                  {format(day, "d")}
                </span>
                <span className="mt-1 h-3 text-[0.625rem] leading-3 tracking-normal">
                  {state.kind === "open" &&
                    (state.remaining === state.max ? (
                      <span
                        className={cn("inline-block h-1.5 w-1.5 rounded-full", selected ? "bg-u-amber" : "bg-u-ink/70")}
                        aria-hidden
                      />
                    ) : (
                      <span className={cn(selected ? "text-u-paper/80" : "text-u-wood")}>残{state.remaining}</span>
                    ))}
                  {state.kind === "full" && <span className="text-u-ink/35">満</span>}
                  {state.kind === "closed" && <span className="text-u-ink/35">休</span>}
                  {state.kind === "event" && <span className="u-latin text-[0.6875rem] italic text-u-green">Event</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] tracking-[0.08em] text-u-ink/70">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-u-ink/70" />
          空きあり
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-u-wood">残2</span>残り枠数
        </li>
        <li>満 満席</li>
        <li>休 休業日</li>
        {eventDays && eventDays.size > 0 && (
          <li>
            <span className="u-latin italic text-u-green">Event</span> パブリックイベント開催日
          </li>
        )}
      </ul>
      <EventDayDialog eventDay={eventDay} onClose={() => setEventDay(null)} />
    </div>
  );
};
