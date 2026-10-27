import { useEffect } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { Option, ReservationOption } from "@/types/option";
import { calculateOptionTotalPrice, formatPrice } from "@/utils/priceCalculations";
import { cn } from "@/lib/utils";

interface OptionPickerProps {
  options: Option[];
  selected: ReservationOption[];
  onChange: (v: ReservationOption[]) => void;
  guestCount: number;
}

const priceLabel = (o: Option) =>
  o.pricing_type === "flat" ? `${formatPrice(o.flat_price || 0)} / 一律` : `${formatPrice(o.price_per_person)} / 人`;

export const OptionPicker = ({ options, selected, onChange, guestCount }: OptionPickerProps) => {
  // 人数を変えたとき、人数連動(per_guest)の数量を追従させ、per_person は人数を上限に丸める
  useEffect(() => {
    if (!selected.length || !guestCount) return;
    let changed = false;
    const next = selected.map((s) => {
      const o = options.find((x) => x.id === s.option_id);
      if (!o) return s;
      const q = o.pricing_type === "per_guest" ? guestCount : o.pricing_type === "per_person" ? Math.min(s.quantity, guestCount) : s.quantity;
      if (q !== s.quantity) changed = true;
      return { ...s, quantity: q };
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCount]);

  const toggle = (o: Option) => {
    if (selected.some((s) => s.option_id === o.id)) {
      onChange(selected.filter((s) => s.option_id !== o.id));
    } else {
      onChange([...selected, { option_id: o.id, quantity: o.pricing_type === "per_guest" ? Math.max(guestCount, 1) : 1 }]);
    }
  };

  const setQty = (id: string, delta: number) =>
    onChange(
      selected.map((s) =>
        s.option_id === id ? { ...s, quantity: Math.min(Math.max(1, s.quantity + delta), Math.max(guestCount, 1)) } : s
      )
    );

  return (
    <div className="grid gap-2.5 sm:gap-3">
      {options.map((o) => {
        const sel = selected.find((s) => s.option_id === o.id);
        const isOn = !!sel;
        return (
          <div key={o.id} data-selected={isOn} className="u-choice overflow-hidden">
            <button
              type="button"
              role="checkbox"
              aria-checked={isOn}
              onClick={() => toggle(o)}
              className="flex w-full items-start gap-4 p-4 text-left sm:p-5"
            >
              <span
                className={cn(
                  "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isOn ? "border-u-copper bg-u-copper text-u-ink" : "border-u-ink/30"
                )}
              >
                {isOn && <Check className="h-3 w-3" strokeWidth={2.5} />}
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[0.9375rem] font-medium tracking-[0.08em]">{o.name}</span>
                  <span className={cn("u-num text-base", isOn ? "text-u-paper/80" : "text-u-ink/70")}>{priceLabel(o)}</span>
                </span>
                {o.description && (
                  <span className={cn("mt-1.5 block text-xs leading-relaxed", isOn ? "text-u-paper/65" : "text-u-ink/65")}>
                    {o.description}
                  </span>
                )}
              </span>
            </button>
            {isOn && (
              <div className="flex items-center justify-between border-t border-u-paper/15 px-4 py-3 text-xs sm:px-5">
                {o.pricing_type === "per_person" ? (
                  <span className="flex items-center gap-3">
                    <span className="text-u-paper/65">数量</span>
                    <button
                      type="button"
                      onClick={() => setQty(o.id, -1)}
                      disabled={sel.quantity <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-u-paper/30 disabled:opacity-30"
                      aria-label={`${o.name}を1つ減らす`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="u-num w-4 text-center text-base" aria-live="polite">
                      {sel.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(o.id, 1)}
                      disabled={sel.quantity >= guestCount}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-u-paper/30 disabled:opacity-30"
                      aria-label={`${o.name}を1つ増やす`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <span className="text-u-paper/65">
                    {o.pricing_type === "per_guest" ? `ご予約人数（${guestCount}名）分を適用` : "1回あたりの料金"}
                  </span>
                )}
                <span className="u-num text-base text-u-copper">
                  {formatPrice(calculateOptionTotalPrice(o, sel.quantity, guestCount))}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
