import { PublicEventSlot } from "@/types/event";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";
import { cn } from "@/lib/utils";

interface EventSlotPickerProps {
  slots: PublicEventSlot[];
  selectedSlotId: string;
  onSelect: (slotId: string) => void;
}

/** 枠を日付ごとにグルーピングして表示し、残席バッジ付きで選択させる */
export const EventSlotPicker = ({ slots, selectedSlotId, onSelect }: EventSlotPickerProps) => {
  const dates = Array.from(new Set(slots.map((slot) => slot.date)));

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-u-ink/20 px-5 py-8 text-center text-sm text-u-ink/65">
        現在ご予約いただける枠はありません
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {dates.map((date) => (
        <div key={date}>
          <div className="mb-3 text-sm tracking-[0.1em]">{formatEventDateLabel(date)}</div>
          <div role="radiogroup" aria-label={formatEventDateLabel(date)} className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            {slots
              .filter((slot) => slot.date === date)
              .map((slot) => {
                const isFull = slot.remaining <= 0;
                const isSelected = slot.id === selectedSlotId;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={isFull}
                    data-selected={isSelected}
                    disabled={isFull}
                    onClick={() => onSelect(slot.id)}
                    className="u-choice flex items-center justify-between gap-3 px-5 py-4"
                  >
                    <span className={cn("u-num text-[1.5rem] font-light leading-none", isFull && "line-through decoration-1")}>
                      {formatEventTimeRange(slot.start_time, slot.end_time)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[0.6875rem] tracking-[0.12em]",
                        isFull
                          ? "text-u-ink/40"
                          : isSelected
                            ? "bg-u-green text-white"
                            : "bg-u-ink/[0.06] text-u-ink/70",
                      )}
                    >
                      {isFull ? "満席" : `残り${slot.remaining}名`}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
};
