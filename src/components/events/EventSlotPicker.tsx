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
      <p className="text-center text-sm font-mplus font-extralight text-black/60 py-8">
        現在ご予約いただける枠はありません。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <div key={date}>
          <div className="text-sm font-mplus font-light text-black mb-3">
            {formatEventDateLabel(date)}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {slots
              .filter((slot) => slot.date === date)
              .map((slot) => {
                const isFull = slot.remaining <= 0;
                const isSelected = slot.id === selectedSlotId;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => onSelect(slot.id)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4 text-left transition-colors font-mplus",
                      isFull
                        ? "border-sauna-stone/10 bg-gray-50 text-black/40 cursor-not-allowed"
                        : isSelected
                          ? "border-sauna-button bg-sauna-button/10"
                          : "border-sauna-stone/20 bg-sauna-base/40 hover:border-sauna-stone/50",
                    )}
                  >
                    <span className="text-sm font-light">
                      {formatEventTimeRange(slot.start_time, slot.end_time)}
                    </span>
                    <span
                      className={cn(
                        "text-xs rounded-full px-3 py-1",
                        isFull
                          ? "bg-gray-200 text-black/50"
                          : "bg-sauna-base border border-sauna-stone/20 text-black/70",
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
