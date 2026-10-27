import { useEffect, useMemo, useRef, useState } from "react";
import { format, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { TimeSlot, ReservationFormData } from "@/types/reservation";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { TermsDialog } from "./TermsDialog";
import { useReservations } from "@/hooks/useReservations";
import { useReservationForm } from "@/hooks/useReservationForm";
import { useShopClosures } from "@/hooks/useShopClosures";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
import { useOptions } from "@/hooks/useOptions";
import { usePriceSettings } from "@/hooks/usePriceSettings";
import { calculateOptionTotalPrice, getPrepayDiscount, getPricePerPersonRegular } from "@/utils/priceCalculations";
import { SLOT_LABELS } from "@/utils/timeSlotRules";
import { BookingCalendar } from "./site/booking/BookingCalendar";
import { SlotPicker, getSlotTimes } from "./site/booking/SlotPicker";
import { GuestPicker } from "./site/booking/GuestPicker";
import { OptionPicker } from "./site/booking/OptionPicker";
import { PaymentPicker } from "./site/booking/PaymentPicker";
import { BookingSummary, type SummaryLine } from "./site/booking/BookingSummary";
import { Step } from "./site/booking/Step";
import { INSTAGRAM_URL } from "./site/SiteNav";
import { cn } from "@/lib/utils";

const FORM_ID = "u-booking-form";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_SLOTS: Record<TimeSlot, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };

const ReservationForm = () => {
  const {
    date,
    setDate,
    timeSlot,
    setTimeSlot,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    people,
    setPeople,
    paymentMethod,
    setPaymentMethod,
    selectedOptions,
    setSelectedOptions,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
    reservationCode,
  } = useReservationForm();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const { data: reservations, isLoading, error, refetch } = useReservations();
  const { closures } = useShopClosures();
  const { data: dailyTimeSlots } = useDailyTimeSlots();
  const { data: options } = useOptions();
  const { data: prices } = usePriceSettings();

  const closedDates = useMemo(() => new Set((closures ?? []).map((c) => c.date)), [closures]);

  // 予約フォームが画面内にある間だけ、モバイル下部の合計バーを出す
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBarVisible(e.isIntersecting), { threshold: 0, rootMargin: "-30% 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const slotReservations = useMemo(() => {
    if (!date || !isValid(date) || !reservations) return EMPTY_SLOTS;
    const ymd = format(date, "yyyy-MM-dd");
    return reservations
      .filter((r) => r.date === ymd && (r.status === "confirmed" || r.status === "pending"))
      .reduce((acc, r) => ({ ...acc, [r.time_slot]: (acc[r.time_slot] ?? 0) + 1 }), { ...EMPTY_SLOTS });
  }, [date, reservations]);

  const guestCount = parseInt(people) || 0;
  // DB に該当人数の設定が無い場合は、確認ダイアログ(getTotalPrice)と同じ既定料金に揃える
  const perPerson = guestCount
    ? prices?.find((p) => p.guest_count === guestCount)?.price_per_person ?? (prices ? getPricePerPersonRegular(guestCount) : undefined)
    : undefined;
  const base = guestCount && perPerson ? perPerson * guestCount : null;
  const optionTotal = useMemo(
    () =>
      selectedOptions.reduce((sum, s) => {
        const o = options?.find((x) => x.id === s.option_id);
        return o ? sum + calculateOptionTotalPrice(o, s.quantity, guestCount) : sum;
      }, 0),
    [selectedOptions, options, guestCount]
  );
  const listTotal = base !== null ? base + optionTotal : null;
  // オンライン事前決済は5%割引(サーバー側 create-reservation と同じ計算)
  const discount = listTotal !== null && paymentMethod === "square_online" ? getPrepayDiscount(listTotal) : 0;
  const total = listTotal !== null ? listTotal - discount : null;

  const handleDateChange = (d: Date) => {
    setDate(d);
    setTimeSlot("");
    // 日付を選んだら時間帯へ視線を送る(モバイルでは画面外になりやすい)
    requestAnimationFrame(() => {
      const el = document.getElementById("step-time");
      if (el && window.innerWidth < 1024) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const missingSteps: { id: string; label: string }[] = [
    !date && { id: "step-date", label: "日付" },
    !timeSlot && { id: "step-time", label: "時間帯" },
    !people && { id: "step-guests", label: "人数" },
    !name.trim() && { id: "step-contact", label: "お名前" },
    !phone.trim() && { id: "step-contact", label: "電話番号" },
    !!email.trim() && !EMAIL_RE.test(email.trim()) && { id: "step-contact", label: "メールアドレスの形式" },
    !termsAccepted && { id: "step-terms", label: "利用規約" },
  ].filter(Boolean) as { id: string; label: string }[];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missingSteps.length) {
      const first = missingSteps[0];
      document.getElementById(first.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.error(
        first.label === "利用規約"
          ? "利用規約をお読みのうえ、同意してください"
          : first.label === "メールアドレスの形式"
          ? "メールアドレスの形式をご確認ください"
          : `${first.label}を入力してください`
      );
      return;
    }
    handleSubmit(e);
  };

  const slotTimes = date && timeSlot ? getSlotTimes(date, timeSlot as TimeSlot, dailyTimeSlots) : null;
  const optionNames = selectedOptions
    .map((s) => options?.find((o) => o.id === s.option_id)?.name)
    .filter(Boolean)
    .join("、");

  const lines: SummaryLine[] = [
    { label: "日付", value: date ? format(date, "yyyy年M月d日（E）", { locale: ja }) : undefined },
    {
      label: "時間帯",
      value: slotTimes ? `${slotTimes.start} – ${slotTimes.end}` : undefined,
      sub: timeSlot ? SLOT_LABELS[timeSlot as TimeSlot] : undefined,
    },
    { label: "人数", value: guestCount ? `${guestCount}名様` : undefined },
    ...(options && options.length > 0 ? [{ label: "オプション", value: optionNames || "なし" }] : []),
    { label: "お支払い", value: paymentMethod === "square_online" ? "オンライン事前決済" : "現地払い" },
  ];

  const currentReservation: ReservationFormData | null =
    date && timeSlot
      ? {
          date: format(date, "yyyy-MM-dd"),
          time_slot: timeSlot as TimeSlot,
          guest_name: name,
          guest_count: guestCount,
          email: email || null,
          phone,
          water_temperature: 15,
          options: selectedOptions,
        }
      : null;

  const hasOptions = !!options && options.length > 0;
  let n = 0;
  const idx = () => ++n;

  return (
    <div ref={sectionRef} className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-0 lg:col-span-7 xl:col-span-8">
        <Step
          id="step-date"
          index={idx()}
          title="日付を選ぶ"
          done={!!date}
          hint={
            <>
              当日のご予約は
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="u-link mx-0.5">
                Instagram
              </a>
              のDMへ
            </>
          }
        >
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1" aria-label="空き状況を読み込み中">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-[3.25rem] animate-pulse sm:h-16 rounded-xl bg-u-ink/[0.05]" style={{ animationDelay: `${i * 20}ms` }} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-u-ink/15 p-6 text-center text-sm">
              <p>空き状況を読み込めませんでした</p>
              <button type="button" onClick={() => refetch()} className="u-btn u-btn-ghost mt-4 !min-h-[2.5rem]">
                再読み込み
              </button>
            </div>
          ) : (
            <BookingCalendar
              value={date}
              onChange={handleDateChange}
              reservations={reservations}
              closedDates={closedDates}
              dailyTimeSlots={dailyTimeSlots}
            />
          )}
        </Step>

        <Step
          id="step-time"
          index={idx()}
          title="時間帯を選ぶ"
          done={!!timeSlot}
          hint={date ? format(date, "M月d日（E）", { locale: ja }) : undefined}
        >
          <SlotPicker
            date={date}
            value={timeSlot}
            onChange={setTimeSlot}
            slotReservations={slotReservations}
            dailyTimeSlots={dailyTimeSlots}
          />
          <p className="mt-3 text-xs text-u-ink/65">受付は開始時刻の10分前から。各回のあいだに清掃・入替のお時間をいただきます</p>
        </Step>

        <Step id="step-guests" index={idx()} title="人数" done={!!people}>
          <GuestPicker value={people} onChange={setPeople} prices={prices} />
        </Step>

        {hasOptions && (
          <Step id="step-options" index={idx()} title="オプション" optional done={selectedOptions.length > 0}>
            {guestCount > 0 ? (
              <OptionPicker options={options!} selected={selectedOptions} onChange={setSelectedOptions} guestCount={guestCount} />
            ) : (
              <div className="rounded-2xl border border-dashed border-u-ink/20 px-5 py-6 text-center text-sm text-u-ink/65">
                人数を選ぶと、オプションを追加できます
              </div>
            )}
          </Step>
        )}

        <Step id="step-contact" index={idx()} title="お客様情報" done={!!name.trim() && !!phone.trim()}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="u-field sm:col-span-2">
              <input
                className="u-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=" "
                autoComplete="name"
                required
              />
              <span className="u-field-label">お名前</span>
            </label>
            <label className="u-field">
              <input
                className="u-input"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder=" "
                autoComplete="tel"
                required
              />
              <span className="u-field-label">電話番号</span>
            </label>
            <label className="u-field">
              <input
                className="u-input"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                autoComplete="email"
              />
              <span className="u-field-label">メールアドレス（任意）</span>
            </label>
          </div>
          <p className="mt-3 text-xs text-u-ink/65">予約確認のご連絡をSMS・メールでお送りします</p>
        </Step>

        <Step id="step-payment" index={idx()} title="お支払い方法" done>
          <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />
        </Step>

        <Step id="step-terms" index={idx()} title="利用規約" done={termsAccepted}>
          <div className="rounded-2xl border border-u-ink/10 bg-white/40 p-5 sm:p-6">
            <p className="text-[0.6875rem] tracking-[0.2em] text-u-ink/65">キャンセルポリシー</p>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {[
                ["2日前まで", "無料"],
                ["24時間前まで", "料金の30%"],
                ["24時間以内", "料金の100%"],
                ["無断キャンセル", "料金の100%"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-u-ink/10 py-1.5">
                  <span className="text-u-ink/70">{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowTermsDialog(true)}
              aria-pressed={termsAccepted}
              className={cn(
                "mt-5 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors",
                termsAccepted ? "border-u-ink bg-u-ink text-u-paper" : "border-u-ink/20 hover:border-u-ink"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                  termsAccepted ? "border-u-copper bg-u-copper text-u-ink" : "border-u-ink/30"
                )}
              >
                {termsAccepted && <Check className="h-3 w-3" strokeWidth={2.5} />}
              </span>
              <span className="flex-1">{termsAccepted ? "利用規約に同意しました" : "利用規約を読んで同意する"}</span>
              <ArrowRight className="h-4 w-4 opacity-50" strokeWidth={1.5} />
            </button>
          </div>
        </Step>

        {/* モバイル・タブレットではサマリーがフォームの後ろに来るため、ここでは送信ボタンを出さない */}
      </form>

      <div className="lg:col-span-5 xl:col-span-4">
        <div className="lg:sticky lg:top-24">
          <BookingSummary
            lines={lines}
            base={base}
            optionTotal={optionTotal}
            discount={discount}
            total={total}
            missing={missingSteps.map((m) => m.label).filter((v, i, a) => a.indexOf(v) === i)}
            formId={FORM_ID}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* モバイル: 下部固定の合計バー */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-500 [transition-timing-function:var(--u-ease)] lg:hidden",
          barVisible ? "translate-y-0" : "translate-y-[120%]"
        )}
        aria-hidden={!barVisible}
        {...(!barVisible ? { inert: "" } : {})}
      >
        <div className="flex items-center gap-3 rounded-full bg-u-ink py-2 pl-5 pr-2 text-u-paper shadow-[0_20px_40px_-12px_rgba(27,28,25,0.6)]">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[0.6875rem] text-u-paper/60">
              {date ? format(date, "M/d（E）", { locale: ja }) : "日付未選択"}
              {timeSlot ? ` · ${SLOT_LABELS[timeSlot as TimeSlot]}` : ""}
              {guestCount ? ` · ${guestCount}名` : ""}
            </div>
            <div className="u-num text-xl leading-tight">{total !== null ? `¥${total.toLocaleString()}` : "¥—"}</div>
          </div>
          <button type="submit" form={FORM_ID} disabled={isSubmitting} className="u-btn u-btn-light !min-h-[2.75rem] !px-5 !text-xs">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "確認へ"}
          </button>
        </div>
      </div>

      <TermsDialog
        open={showTermsDialog}
        onOpenChange={setShowTermsDialog}
        checked={termsAccepted}
        onCheckedChange={setTermsAccepted}
      />

      {currentReservation && (
        <ReservationConfirmDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmReservation}
          reservation={currentReservation}
          onEdit={() => setShowConfirmDialog(false)}
          isSubmitting={isSubmitting}
          reservationCode={reservationCode}
          paymentMethod={paymentMethod}
        />
      )}
    </div>
  );
};

export default ReservationForm;
