import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTweenNumber } from "@/hooks/useTweenNumber";
import { PREPAY_DISCOUNT_PERCENT } from "@/utils/priceCalculations";

export interface SummaryLine {
  label: string;
  value?: string;
  sub?: string;
}

interface BookingSummaryProps {
  lines: SummaryLine[];
  base: number | null;
  optionTotal: number;
  /** オンライン事前決済の割引額(0なら表示しない) */
  discount: number;
  total: number | null;
  missing: string[];
  formId: string;
  isSubmitting: boolean;
}

const yen = (n: number) => `¥${n.toLocaleString()}`;

export const BookingSummary = ({ lines, base, optionTotal, discount, total, missing, formId, isSubmitting }: BookingSummaryProps) => {
  const ready = missing.length === 0;
  const shownTotal = useTweenNumber(total);
  return (
    <aside
      className="relative overflow-hidden rounded-[1.75rem] bg-u-ink text-u-paper shadow-[0_40px_80px_-40px_rgba(27,28,25,0.7)]"
      aria-label="ご予約内容"
    >
      {/* ロゴを大きく敷いて質感を出す */}
      <span className="u-mark pointer-events-none absolute -right-10 -top-8 w-48 text-u-paper/[0.04]" aria-hidden />
      <div className="relative p-6 sm:p-7">
        <div className="flex items-baseline justify-between">
          <span className="u-latin text-xl italic">Your reservation</span>
          <span className="text-[0.625rem] tracking-[0.24em] text-u-paper/60">ご予約内容</span>
        </div>

        <dl className="mt-6 space-y-3.5">
          {lines.map((l) => (
            <div key={l.label} className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3 text-sm">
              <dt className="text-[0.6875rem] tracking-[0.16em] text-u-paper/60">{l.label}</dt>
              <dd className={cn("min-w-0 transition-colors duration-500", !l.value && "text-u-paper/30")}>
                <span className="block truncate">{l.value ?? "—"}</span>
                {l.sub && <span className="block text-xs text-u-paper/60">{l.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ミシン目 */}
      <div className="relative h-6" aria-hidden>
        <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-u-paper" />
        <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-u-paper" />
        <span className="absolute inset-x-6 top-1/2 border-t border-dashed border-u-paper/20" />
      </div>

      <div className="relative p-6 pt-3 sm:p-7 sm:pt-4">
        <div className="space-y-1.5 text-xs text-u-paper/55">
          <div className="flex justify-between">
            <span>基本料金</span>
            <span className="u-num text-sm">{base !== null ? yen(base) : "—"}</span>
          </div>
          {optionTotal > 0 && (
            <div className="flex justify-between">
              <span>オプション</span>
              <span className="u-num text-sm">{yen(optionTotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-u-copper">
              <span>事前決済割引（{PREPAY_DISCOUNT_PERCENT}%）</span>
              <span className="u-num text-sm">−{yen(discount)}</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <span className="text-[0.6875rem] tracking-[0.2em] text-u-paper/60">合計</span>
          <span className="u-num text-[2.75rem] font-light leading-none" aria-hidden>
            {shownTotal !== null ? yen(shownTotal) : "¥—"}
          </span>
          <span className="sr-only" aria-live="polite">
            {total !== null ? `合計 ${yen(total)}` : ""}
          </span>
        </div>

        <button type="submit" form={formId} disabled={isSubmitting} className="u-btn u-btn-light mt-6 w-full">
          予約内容を確認する
          <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
        </button>
        <p className="mt-3 text-center text-[0.6875rem] leading-relaxed text-u-paper/60">
          {ready ? "次の画面で内容を確認してから確定します" : `未入力: ${missing.join("・")}`}
        </p>
        <p className="mt-5 border-t border-u-paper/10 pt-4 text-center text-[0.6875rem] leading-relaxed text-u-paper/70">
          手ぶらOK — 水着・サウナハット・ポンチョ・サンダルは無料貸出
        </p>
      </div>
    </aside>
  );
};
