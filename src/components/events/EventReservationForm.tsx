import { ArrowRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PublicEvent } from "@/types/event";
import { useEventReservationForm } from "@/hooks/useEventReservationForm";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";
import { cn } from "@/lib/utils";

interface EventReservationFormProps {
  event: PublicEvent;
  form: ReturnType<typeof useEventReservationForm>;
}

/** 選択済みの枠に対する予約者情報フォーム + 確認ダイアログ */
export const EventReservationForm = ({ event, form }: EventReservationFormProps) => {
  const {
    selectedSlot,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    people,
    setPeople,
    guestCount,
    totalPrice,
    maxSelectableGuests,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
  } = form;

  if (!selectedSlot) {
    return (
      <div className="rounded-2xl border border-dashed border-u-ink/20 px-5 py-8 text-center text-sm text-u-ink/65">
        ご希望の枠を選択すると、お客様情報の入力に進めます
      </div>
    );
  }

  const priceLabel = totalPrice > 0
    ? `¥${totalPrice.toLocaleString()}`
    : event.price_note || "無料";
  const isPrepaid = event.payment_type === "prepaid" && totalPrice > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 text-left" style={{ animation: "u-fade-up .7s var(--u-ease) both" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-u-ink px-5 py-4 text-u-paper">
          <span className="text-[0.6875rem] tracking-[0.2em] text-u-paper/55">選択中の枠</span>
          <span className="text-sm">
            {formatEventDateLabel(selectedSlot.date)}{" "}
            <span className="u-num text-lg">{formatEventTimeRange(selectedSlot.start_time, selectedSlot.end_time)}</span>
            <span className="ml-2 text-u-wood">残り{selectedSlot.remaining}名</span>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="u-field sm:col-span-2">
            <input
              id="event-guest-name"
              className="u-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=" "
              autoComplete="name"
              maxLength={100}
            />
            <span className="u-field-label">お名前</span>
          </label>
          <label className="u-field">
            <input
              id="event-email"
              className="u-input"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              autoComplete="email"
            />
            <span className="u-field-label">メールアドレス</span>
          </label>
          <label className="u-field">
            <input
              id="event-phone"
              className="u-input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder=" "
              autoComplete="tel"
            />
            <span className="u-field-label">電話番号</span>
          </label>
        </div>
        <p className="-mt-3 text-xs text-u-ink/65">予約確認・キャンセル用のリンクをメールでお送りします<br />すべて必須項目です</p>

        <div>
          <p className="mb-3 text-sm tracking-[0.1em]">人数</p>
          <div role="radiogroup" aria-label="人数" className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
            {Array.from({ length: maxSelectableGuests }, (_, i) => i + 1).map((n) => {
              const selected = people === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected}
                  onClick={() => setPeople(String(n))}
                  className="u-choice flex items-baseline justify-center py-4 !text-center"
                >
                  <span className="u-num text-[1.75rem] font-light leading-none">{n}</span>
                  <span className="ml-0.5 text-xs">名</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("rounded-2xl border border-u-ink/10 bg-white/40 p-5 transition-opacity", guestCount > 0 ? "opacity-100" : "opacity-50")}>
          <div className="flex items-end justify-between">
            <span className="text-[0.6875rem] tracking-[0.2em] text-u-ink/70">料金</span>
            <span className="u-num text-[2.25rem] font-light leading-none">{guestCount > 0 ? priceLabel : "—"}</span>
          </div>
          {guestCount > 0 && totalPrice > 0 && (
            <p className="mt-2 text-right text-xs text-u-ink/65">
              お一人様 ¥{event.price_per_person.toLocaleString()} × {guestCount}名
              {isPrepaid
                ? "・事前決済（オンライン）"
                : event.price_note ? `・${event.price_note}` : "・当日現地払い"}
            </p>
          )}
        </div>

        <button type="submit" className="u-btn u-btn-primary w-full" disabled={isSubmitting}>
          {isPrepaid ? "決済へ進む" : "予約する"}
          <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
        </button>
      </form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="u-site w-[calc(100%-1.5rem)] max-w-[30rem] gap-0 rounded-[1.75rem] border-0 bg-u-paper p-6 sm:rounded-[1.75rem] sm:p-8">
          <AlertDialogHeader className="text-left">
            <p className="u-latin text-sm italic text-u-ink/65">Confirm</p>
            <AlertDialogTitle className="u-display text-xl font-medium tracking-[0.12em]">予約内容の確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="pt-4 text-left text-u-ink">
                <div className="rounded-2xl bg-u-ink p-5 text-u-paper">
                  <p className="text-sm text-u-paper/70">{event.title}</p>
                  <p className="mt-2 text-sm">
                    {formatEventDateLabel(selectedSlot.date)}{" "}
                    <span className="u-num text-2xl font-light">
                      {formatEventTimeRange(selectedSlot.start_time, selectedSlot.end_time)}
                    </span>
                  </p>
                </div>
                <dl className="mt-4">
                  {[
                    ["お名前", name],
                    ["人数", `${guestCount}名`],
                    ["料金", priceLabel],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[5rem_1fr] gap-3 border-b border-u-ink/10 py-3 text-sm">
                      <dt className="text-xs tracking-[0.12em] text-u-ink/65">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-2xl border border-u-amber/40 bg-u-amber/[0.08] p-4 text-xs leading-[1.9] text-u-ink/80">
                  {isPrepaid
                    ? `このあと決済ページ（Square）へ移動します\nお席は20分間確保され、時間内にお支払いが完了しない場合は予約が無効になります\nお支払い完了後、確認メールが ${email} に送信されます`
                    : `この内容で予約を確定します\n確認メールが ${email} に送信されます`}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex-row gap-3 space-x-0 sm:space-x-0">
            <AlertDialogCancel disabled={isSubmitting} className="u-btn u-btn-ghost mt-0 h-auto flex-1 border-u-ink/25 bg-transparent">
              戻る
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReservation();
              }}
              disabled={isSubmitting}
              className="u-btn u-btn-primary h-auto flex-[1.6] hover:bg-u-ink"
            >
              {isSubmitting ? "送信中..." : isPrepaid ? "決済へ進む" : "予約を確定する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
