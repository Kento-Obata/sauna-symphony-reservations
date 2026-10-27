import type { PriceSetting } from "@/types/price";
import { cn } from "@/lib/utils";

const COUNTS = [2, 3, 4, 5, 6];

interface GuestPickerProps {
  value: string;
  onChange: (v: string) => void;
  prices: PriceSetting[] | undefined;
}

export const GuestPicker = ({ value, onChange, prices }: GuestPickerProps) => (
  <div>
    <div role="group" aria-label="人数" className="grid grid-cols-5 gap-2 sm:gap-3">
      {COUNTS.map((n) => {
        const per = prices?.find((p) => p.guest_count === n)?.price_per_person;
        const selected = value === String(n);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={selected}
            data-selected={selected}
            onClick={() => onChange(String(n))}
            className="u-choice flex flex-col items-center px-1 py-4 !text-center"
          >
            <span className="flex items-baseline">
              <span className="u-num text-[2rem] font-light leading-none">{n}</span>
              <span className="ml-0.5 text-xs">名</span>
            </span>
            <span className={cn("mt-2 text-[0.625rem] leading-tight tracking-normal sm:text-[0.6875rem]", selected ? "text-u-paper/70" : "text-u-ink/65")}>
              {per ? (
                <>
                  <span className="u-num text-[0.8125rem]">¥{per.toLocaleString()}</span>
                  <span className="hidden xs:inline">/人</span>
                </>
              ) : (
                " "
              )}
            </span>
          </button>
        );
      })}
    </div>
    <p className="mt-3 text-xs text-u-ink/65">※ 1名様でのご利用は2名様料金で承ります</p>
  </div>
);
