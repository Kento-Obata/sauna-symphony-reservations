import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTotalPrice, formatPrice, getPrepayDiscount, PREPAY_DISCOUNT_PERCENT } from "@/utils/priceCalculations";
import { useOptions } from "@/hooks/useOptions";
import { Option } from "@/types/option";
import { useDailyTimeSlots } from "@/hooks/useDailyTimeSlots";
import { getDefaultSlotTimesForDate, SLOT_LABELS } from "@/utils/timeSlotRules";

const getTimeSlotDisplay = (timeSlot: TimeSlot, date: string, dailyTimeSlots: any[]) => {
  const dailySlot = dailyTimeSlots?.find(dts =>
    dts.date === date && dts.time_slot === timeSlot && dts.is_active
  );

  if (dailySlot) {
    return `${dailySlot.start_time.slice(0, 5)} – ${dailySlot.end_time.slice(0, 5)}`;
  }

  if (!date) return timeSlot;

  const defaultSlot = getDefaultSlotTimesForDate(date, timeSlot, dailyTimeSlots);
  return `${defaultSlot.start} – ${defaultSlot.end}`;
};

interface ReservationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  reservation: ReservationFormData;
  isSubmitting: boolean;
  reservationCode?: string;
  paymentMethod?: "onsite" | "square_online";
}

export const ReservationConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  onEdit,
  reservation,
  isSubmitting,
  paymentMethod = "onsite",
}: ReservationConfirmDialogProps) => {
  const isPrepaid = paymentMethod === "square_online";
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const { data: dailyTimeSlots } = useDailyTimeSlots();
  const { data: options } = useOptions();

  // 選択されたオプションの情報を取得
  const selectedOptions = options?.filter(option =>
    reservation.options?.some(selectedOption => selectedOption.option_id === option.id)
  ) || [];

  // オプションの合計金額を計算
  const calculateOptionsTotalPrice = (options: Option[], selectedOptions: ReservationFormData["options"] = []) => {
    return selectedOptions.reduce((total, selectedOption) => {
      const option = options.find(opt => opt.id === selectedOption.option_id);
      if (option) {
        if (option.pricing_type === 'flat') {
          return total + (option.flat_price || 0);
        } else if (option.pricing_type === 'per_guest') {
          return total + (option.price_per_person * reservation.guest_count);
        } else {
          return total + (option.price_per_person * selectedOption.quantity);
        }
      }
      return total;
    }, 0);
  };

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        const dateObj = reservation.date ? new Date(reservation.date) : undefined;
        const basePrice = await getTotalPrice(
          reservation.guest_count,
          dateObj
        );

        // オプション料金を加算
        const optionsPrice = calculateOptionsTotalPrice(options || [], reservation.options);
        setTotalPrice(basePrice + optionsPrice);
      } catch (error) {
        console.error("料金の計算に失敗しました:", error);
      }
    };

    calculatePrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation.guest_count, reservation.date, reservation.options, options]);

  const dateObj = reservation.date ? new Date(`${reservation.date}T00:00:00`) : null;
  const optionsTotal = calculateOptionsTotalPrice(options || [], reservation.options);
  // オンライン事前決済は5%割引(サーバー側 create-reservation と同じ計算)
  const discount = isPrepaid ? getPrepayDiscount(totalPrice) : 0;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "お名前", value: reservation.guest_name },
    { label: "人数", value: `${reservation.guest_count}名様` },
    { label: "電話番号", value: reservation.phone },
    ...(reservation.email ? [{ label: "メール", value: reservation.email }] : []),
    { label: "お支払い", value: isPrepaid ? "オンライン事前決済" : "現地払い（カード・現金）" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="bg-u-ink/50 backdrop-blur-sm"
        className="u-site max-h-[92svh] w-[calc(100%-1.5rem)] max-w-[30rem] gap-0 overflow-y-auto rounded-[1.75rem] border-0 bg-u-paper p-0 shadow-[0_40px_120px_-30px_rgba(27,28,25,0.6)] sm:rounded-[1.75rem] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-transparent [&>button[data-state=open]]:bg-transparent [&>button[data-state=open]]:text-u-ink [&>button:hover]:bg-u-ink/5 [&>button:focus]:ring-0 [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-u-ink/30 [&>button:focus-visible]:ring-offset-0"
      >
        <div className="p-6 pb-0 sm:p-8 sm:pb-0">
          <p className="u-latin text-sm italic text-u-ink/65">Confirm</p>
          <DialogTitle className="u-mincho mt-1 text-xl font-medium tracking-[0.12em]">ご予約内容の確認</DialogTitle>
          <DialogDescription className="sr-only">内容をご確認のうえ、予約へお進みください</DialogDescription>

          {/* 日時を大きく */}
          <div className="mt-6 rounded-2xl bg-u-ink p-5 text-u-paper sm:p-6">
            {dateObj && (
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="u-num text-[2.75rem] font-light leading-none">{format(dateObj, "M.d")}</span>
                  <span className="text-sm text-u-paper/70">{format(dateObj, "（E）", { locale: ja })}</span>
                </div>
                <span className="u-num text-sm text-u-paper/60">{format(dateObj, "yyyy")}</span>
              </div>
            )}
            <div className="mt-4 flex items-baseline justify-between border-t border-u-paper/15 pt-4">
              <span className="text-xs tracking-[0.16em] text-u-paper/60">{SLOT_LABELS[reservation.time_slot]}</span>
              <span className="u-num text-2xl font-light">
                {getTimeSlotDisplay(reservation.time_slot, reservation.date, dailyTimeSlots || [])}
              </span>
            </div>
          </div>

          <dl className="mt-5">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-u-ink/10 py-3 text-sm">
                <dt className="text-xs tracking-[0.12em] text-u-ink/65">{r.label}</dt>
                <dd className="break-all">{r.value}</dd>
              </div>
            ))}
            {selectedOptions.length > 0 && (
              <div className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-u-ink/10 py-3 text-sm">
                <dt className="text-xs tracking-[0.12em] text-u-ink/65">オプション</dt>
                <dd>
                  <ul className="space-y-1">
                    {selectedOptions.map(option => {
                      const selectedOption = reservation.options?.find(o => o.option_id === option.id);
                      const quantity = selectedOption?.quantity || 0;
                      const subtotal = option.pricing_type === 'flat'
                        ? (option.flat_price || 0)
                        : option.pricing_type === 'per_guest'
                        ? option.price_per_person * reservation.guest_count
                        : option.price_per_person * quantity;
                      return (
                        <li key={option.id} className="flex justify-between gap-3">
                          <span>
                            {option.name}
                            {option.pricing_type === 'per_person' && ` × ${quantity}`}
                          </span>
                          <span className="u-num">{formatPrice(subtotal)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          {discount > 0 && (
            <div className="mt-5 space-y-1 text-xs text-u-ink/70">
              <div className="flex justify-between">
                <span>料金</span>
                <span className="u-num text-sm">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-u-copper-deep">
                <span>事前決済割引（{PREPAY_DISCOUNT_PERCENT}%）</span>
                <span className="u-num text-sm">−{formatPrice(discount)}</span>
              </div>
            </div>
          )}
          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs tracking-[0.16em] text-u-ink/70">
              合計
              {optionsTotal > 0 && <span className="ml-2 text-u-ink/65">（オプション {formatPrice(optionsTotal)} を含む）</span>}
            </span>
            <span className="u-num text-[2.25rem] font-light leading-none">{formatPrice(totalPrice - discount)}</span>
          </div>

          <div className="mt-6 rounded-2xl border border-u-copper/40 bg-u-copper/[0.08] p-4 text-xs leading-[1.9] text-u-ink/80">
            {isPrepaid ? (
              <>
                このあと決済ページ（Square）へ移動します。お席は<strong className="font-medium text-u-copper-deep">20分間</strong>
                確保され、お支払いの完了と同時に予約が確定します
              </>
            ) : (
              <>
                仮予約のあと、確定用のリンクをSMS・メールでお送りします。
                <strong className="font-medium text-u-copper-deep">2時間以内</strong>にリンクから確定してください
              </>
            )}
            <span className="mt-1 block text-u-ink/65">当日は開始時刻の10分前からご案内いたします</span>
          </div>
        </div>

        <div className="sticky bottom-0 mt-6 flex gap-3 bg-gradient-to-t from-u-paper via-u-paper to-u-paper/0 p-6 pt-4 sm:p-8 sm:pt-4">
          <button type="button" onClick={onEdit} disabled={isSubmitting} className="u-btn u-btn-ghost flex-1 !px-4">
            修正する
          </button>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} className="u-btn u-btn-primary flex-[1.6] !px-4">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isPrepaid ? "決済ページへ移動中" : "送信中"}
              </>
            ) : (
              <>
                {isPrepaid ? "決済へ進む" : "仮予約する"}
                <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
