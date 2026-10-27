import { addDays } from "date-fns";
import { usePriceSettings } from "@/hooks/usePriceSettings";
import { getDefaultApplicableSlots, getDefaultSlotTimesForDate, SLOT_LABELS, SLOT_ORDER } from "@/utils/timeSlotRules";
import { isWeekendOrHoliday } from "@/utils/holidayUtils";
import type { TimeSlot } from "@/types/reservation";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";
import { PREPAY_DISCOUNT_PERCENT } from "@/utils/priceCalculations";

// 表示用の「平日」「土日祝」の既定スケジュールを、予約ロジックと同じルールから導く
const sampleDate = (wantWeekend: boolean) => {
  let d = addDays(new Date(), 1);
  for (let i = 0; i < 30; i++) {
    const isWe = isWeekendOrHoliday(d);
    if (isWe === wantWeekend && (wantWeekend ? d.getDay() === 6 : true)) return d;
    d = addDays(d, 1);
  }
  return d;
};

const scheduleFor = (date: Date) => {
  const open = getDefaultApplicableSlots(date);
  return SLOT_ORDER.map((slot: TimeSlot) => ({
    slot,
    open: open.includes(slot),
    ...getDefaultSlotTimesForDate(date, slot),
  }));
};

const Schedule = ({ title, latin, rows, delay }: { title: string; latin: string; rows: ReturnType<typeof scheduleFor>; delay: number }) => (
  <Reveal delay={delay} className="rounded-[1.5rem] border border-u-ink/10 bg-u-paper/50 p-6 backdrop-blur-sm sm:p-8">
    <div className="flex items-baseline justify-between">
      <h3 className="u-display text-xl tracking-[0.14em]">{title}</h3>
      <span className="u-latin text-sm italic text-u-ink/80">{latin}</span>
    </div>
    <ul className="mt-6">
      {rows.map((r) => (
        <li
          key={r.slot}
          className={cn("flex items-baseline justify-between border-t border-u-ink/10 py-3.5", !r.open && "text-u-ink/35")}
        >
          <span className="text-sm tracking-[0.16em]">{SLOT_LABELS[r.slot]}</span>
          <span className="flex items-baseline gap-3">
            {!r.open && <span className="text-[0.6875rem] tracking-[0.12em]">おやすみ</span>}
            <span className={cn("u-num text-xl font-light", !r.open && "line-through decoration-1")}>
              {r.start} – {r.end}
            </span>
          </span>
        </li>
      ))}
    </ul>
  </Reveal>
);

export const HoursPrice = () => {
  const { data: prices, isLoading } = usePriceSettings();
  const weekday = scheduleFor(sampleDate(false));
  const weekend = scheduleFor(sampleDate(true));
  const rows = (prices ?? []).filter((p) => p.guest_count >= 2);
  const maxTotal = Math.max(1, ...rows.map((r) => r.guest_count * r.price_per_person));

  return (
    <section id="hours" className="scroll-mt-16 py-24 md:py-36" aria-labelledby="hours-title">
      <div className="u-container">
        <SectionHeading
          index="03"
          latin="Hours & Price"
          title={<span id="hours-title">営業時間と料金</span>}
          lead={"1回150分の完全貸切\n時間帯の空きはカレンダーで日ごとにご確認いただけます"}
        />

        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 md:gap-6">
          <Schedule title="平日" latin="Weekdays" rows={weekday} delay={0} />
          <Schedule title="土日・祝日" latin="Weekends & Holidays" rows={weekend} delay={120} />
        </div>
        <Reveal as="p" className="mt-4 text-xs text-u-ink/80">
          ※ 日によって開放する時間帯が変わる場合があります<br />最新の空きは予約カレンダーをご覧ください
        </Reveal>

        <div className="mt-20 md:mt-28">
          <Reveal className="flex items-baseline justify-between border-b border-u-ink/20 pb-4">
            <h3 className="u-display text-xl tracking-[0.14em]">料金</h3>
            <span className="text-xs text-u-ink/80">1回（150分）あたり</span>
          </Reveal>
          {isLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse border-b border-u-ink/10 bg-u-ink/[0.03]" />
              ))}
            </div>
          ) : (
            <ul>
              {rows.map((r, i) => {
                const total = r.guest_count * r.price_per_person;
                return (
                  <Reveal as="li" key={r.id} delay={i * 70} className="group relative border-b border-u-ink/10">
                    {/* 合計額に比例した帯。人数が増えるほど1人あたりは下がることが一目で分かる */}
                    <span
                      className="absolute inset-y-0 left-0 bg-u-paper/40 transition-[width] duration-1000 [transition-timing-function:var(--u-ease)] group-hover:bg-u-paper/70"
                      style={{ width: `${(total / maxTotal) * 100}%` }}
                      aria-hidden
                    />
                    <div className="relative grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 px-1 py-5 sm:grid-cols-[8rem_1fr_auto] sm:py-6">
                      <span className="flex items-baseline">
                        <span className="u-num text-[2.25rem] font-light leading-none sm:text-[2.75rem]">{r.guest_count}</span>
                        <span className="ml-1 text-sm">名</span>
                      </span>
                      <span className="text-xs text-u-ink/80 sm:text-sm">
                        お一人様 <span className="u-num text-base text-u-ink sm:text-lg">¥{r.price_per_person.toLocaleString()}</span>
                      </span>
                      <span className="u-num text-[1.625rem] font-light leading-none sm:text-[2.25rem]">¥{total.toLocaleString()}</span>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          )}
          <Reveal as="div" className="mt-5 flex flex-col gap-2 text-xs text-u-ink/80 sm:flex-row sm:justify-between">
            <span>※ 1名様でのご利用は2名様料金で承ります</span>
            <span>
              お支払い: オンライン事前決済（カード）
              <strong className="mx-1 rounded-full bg-u-ink px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.12em] text-u-paper">
                {PREPAY_DISCOUNT_PERCENT}%OFF
              </strong>
              ／ 現地でカード・現金
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
