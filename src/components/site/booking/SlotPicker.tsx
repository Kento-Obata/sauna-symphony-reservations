import { format } from "date-fns";
import type { TimeSlot } from "@/types/reservation";
import { getApplicableSlotsForDate, getDefaultSlotTimesForDate, SLOT_LABELS } from "@/utils/timeSlotRules";
import { isTimeSlotDisabled } from "@/components/TimeSlotSelect";
import { cn } from "@/lib/utils";

// 1枠1組(既存仕様)
const MAX_RESERVATIONS = 1;

const SLOT_LATIN: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

interface DailySlotRow {
  date: string;
  time_slot: string;
  is_active?: boolean;
  start_time?: string;
  end_time?: string;
}

interface SlotPickerProps {
  date: Date | undefined;
  value: TimeSlot | "";
  onChange: (slot: TimeSlot) => void;
  slotReservations: Record<TimeSlot, number>;
  dailyTimeSlots: DailySlotRow[] | undefined;
}

export const getSlotTimes = (date: Date, slot: TimeSlot, dailyTimeSlots?: DailySlotRow[]) => {
  const ymd = format(date, "yyyy-MM-dd");
  const row = dailyTimeSlots?.find((d) => d.date === ymd && d.time_slot === slot && d.is_active);
  if (row?.start_time && row?.end_time) return { start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
  const t = getDefaultSlotTimesForDate(date, slot, dailyTimeSlots);
  return { start: t.start.slice(0, 5), end: t.end.slice(0, 5) };
};

export const SlotPicker = ({ date, value, onChange, slotReservations, dailyTimeSlots }: SlotPickerProps) => {
  if (!date) {
    return (
      <div className="rounded-2xl border border-dashed border-u-ink/20 px-5 py-8 text-center text-sm text-u-ink/65">
        日付を選ぶと、その日の時間帯が表示されます
      </div>
    );
  }

  const slots = getApplicableSlotsForDate(date, dailyTimeSlots);

  return (
    <div role="group" aria-label="時間帯" className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {slots.map((slot, i) => {
        const t = getSlotTimes(date, slot, dailyTimeSlots);
        const booked = (slotReservations[slot] ?? 0) >= MAX_RESERVATIONS;
        const tooLate = isTimeSlotDisabled(slot, date, dailyTimeSlots);
        const disabled = booked || tooLate;
        const selected = value === slot;
        return (
          <button
            key={slot}
            type="button"
            aria-pressed={selected}
            aria-disabled={disabled}
            data-selected={selected}
            disabled={disabled}
            onClick={() => onChange(slot)}
            className="u-choice flex flex-col px-4 py-4 sm:px-5 sm:py-5"
            style={{ animation: `u-fade-up .7s var(--u-ease) ${i * 60}ms both` }}
          >
            <span className="flex w-full items-baseline justify-between gap-2">
              <span className="u-display text-lg tracking-[0.12em]">{SLOT_LABELS[slot]}</span>
              <span className={cn("u-latin text-xs italic", selected ? "text-u-paper/60" : "text-u-ink/65")}>
                {SLOT_LATIN[slot]}
              </span>
            </span>
            <span className={cn("u-num mt-2 text-[1.5rem] font-light leading-none sm:text-[1.75rem]", disabled && "line-through decoration-1")}>
              {t.start}
              <span className="mx-1 opacity-50">–</span>
              {t.end}
            </span>
            <span
              className={cn(
                "mt-3 text-[0.6875rem] tracking-[0.16em]",
                selected ? "text-u-amber" : disabled ? "text-u-ink/40" : "text-u-ink/70"
              )}
            >
              {booked ? "予約済み" : tooLate ? "受付終了" : selected ? "選択中" : "空きあり"}
            </span>
          </button>
        );
      })}
    </div>
  );
};
