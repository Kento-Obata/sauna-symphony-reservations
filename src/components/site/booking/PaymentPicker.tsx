import { CreditCard, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREPAY_DISCOUNT_PERCENT } from "@/utils/priceCalculations";

export type PaymentMethod = "onsite" | "square_online";

const METHODS: { value: PaymentMethod; title: string; badge?: string; desc: string; Icon: typeof CreditCard }[] = [
  {
    value: "square_online",
    title: "オンライン事前決済",
    badge: `${PREPAY_DISCOUNT_PERCENT}%OFF`,
    desc: `クレジットカードで今すぐお支払い\n料金が${PREPAY_DISCOUNT_PERCENT}%割引になり、決済の完了と同時に予約が確定します`,
    Icon: CreditCard,
  },
  {
    value: "onsite",
    title: "現地払い",
    desc: "当日にカードまたは現金でお支払い\n仮予約後、メール/SMSのリンクから2時間以内に確定してください",
    Icon: Store,
  },
];

interface PaymentPickerProps {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}

export const PaymentPicker = ({ value, onChange }: PaymentPickerProps) => (
  <div role="group" aria-label="お支払い方法" className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
    {METHODS.map(({ value: v, title, badge, desc, Icon }) => {
      const selected = value === v;
      return (
        <button
          key={v}
          type="button"
          aria-pressed={selected}
          data-selected={selected}
          onClick={() => onChange(v)}
          className="u-choice flex flex-col p-5"
        >
          <span className="flex w-full items-center justify-between">
            <Icon className={cn("h-5 w-5", selected ? "text-u-amber" : "text-u-ink/70")} strokeWidth={1.4} />
            {badge && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[0.625rem] tracking-[0.16em]",
                  selected ? "bg-u-amber text-u-ink" : "bg-u-ink/[0.07] text-u-ink/70"
                )}
              >
                {badge}
              </span>
            )}
          </span>
          <span className="mt-4 text-[0.9375rem] font-medium tracking-[0.08em]">{title}</span>
          <span className={cn("mt-1.5 text-xs leading-relaxed", selected ? "text-u-paper/65" : "text-u-ink/65")}>{desc}</span>
        </button>
      );
    })}
  </div>
);
