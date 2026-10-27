
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Reservation } from "@/types/reservation";
import { getTotalPrice, formatPrice } from "@/utils/priceCalculations";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";
import { formatReservationTime } from "@/utils/reservationTime";

interface ReservationInfoProps {
  reservation: Reservation;
}

export const ReservationInfo = ({ reservation }: ReservationInfoProps) => {
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [options, setOptions] = useState<{option: Option, quantity: number, total_price?: number}[]>([]);

  // オプション情報を取得
  useEffect(() => {
    const fetchReservationOptions = async () => {
      try {
        console.log("Fetching options for reservation ID:", reservation.id);
        
        if (!reservation.id) {
          console.log("No reservation ID provided");
          return;
        }
        
        const { data: reservationOptions, error } = await supabase
          .from("reservation_options")
          .select(`
            quantity,
            total_price,
            options:option_id (
              id, name, description, price_per_person, pricing_type, flat_price
            )
          `)
          .eq("reservation_id", reservation.id);

        if (error) {
          console.error("オプション情報の取得に失敗しました:", error);
          return;
        }

        // オプション情報を整形
        if (reservationOptions && reservationOptions.length > 0) {
          console.log("Found reservation options:", reservationOptions);
          const formattedOptions = reservationOptions.map(item => ({
            option: item.options as unknown as Option, // Cast to unknown first, then to Option
            quantity: item.quantity,
            total_price: item.total_price // Include stored total_price
          }));
          setOptions(formattedOptions);
        } else {
          console.log("No options found for this reservation");
        }
      } catch (error) {
        console.error("オプション情報の取得中にエラーが発生しました:", error);
      }
    };

    if (reservation.id) {
      fetchReservationOptions();
    }
  }, [reservation.id]);

  useEffect(() => {
    const calculatePrice = async () => {
      try {
        // 日付文字列をDateオブジェクトに変換
        const dateObj = reservation.date ? new Date(reservation.date) : undefined;
        console.log('ReservationInfo - Calculating price for date:', dateObj);
        
        const price = await getTotalPrice(
          reservation.guest_count,
          dateObj
        );
        setTotalPrice(price);
      } catch (error) {
        console.error("料金の計算に失敗しました:", error);
      }
    };

    calculatePrice();
  }, [reservation.guest_count, reservation.date]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return "仮予約";
      case "pending_payment":
        return "お支払い手続き中";
      case "confirmed":
        return "予約確定";
      case "cancelled":
        return "キャンセル済み";
      case "expired":
        return "無効(お支払い期限切れ)";
      default:
        return status;
    }
  };

  const getPaymentDisplay = () => {
    if (reservation.payment_status === "refunded") return "返金済み";
    if (reservation.payment_status === "paid") return "支払済(オンライン事前決済)";
    if (reservation.status === "pending_payment") return "お支払い手続き中";
    return "当日現地払い";
  };



  // オプションの合計金額を計算
  const calculateOptionsTotal = () => {
    return options.reduce((total, item) => {
      // Use stored total_price if available
      if (item.total_price !== undefined) {
        return total + item.total_price;
      }
      // Fallback calculation (should not happen in normal cases)
      if (item.option.pricing_type === 'flat') {
        return total + (item.option.flat_price || 0);
      } else if (item.option.pricing_type === 'per_guest') {
        // per_guestは予約人数を使用
        return total + (item.option.price_per_person * reservation.guest_count);
      } else {
        return total + (item.option.price_per_person * item.quantity);
      }
    }, 0);
  };

  const dateObj = new Date(`${reservation.date}T00:00:00`);
  const isInactive = reservation.status === "cancelled" || reservation.status === "expired";
  const isPending = reservation.status === "pending" || reservation.status === "pending_payment";

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "予約コード", value: <span className="u-num text-base tracking-[0.08em]">{reservation.reservation_code}</span> },
    { label: "お名前", value: reservation.guest_name },
    { label: "人数", value: `${reservation.guest_count}名様` },
    { label: "電話番号", value: reservation.phone },
    ...(reservation.email ? [{ label: "メール", value: <span className="break-all">{reservation.email}</span> }] : []),
    { label: "お支払い", value: getPaymentDisplay() },
  ];

  return (
    <div>
      <div className={`relative overflow-hidden rounded-[1.5rem] bg-u-ink p-6 text-u-paper sm:p-8 ${isInactive ? "opacity-70" : ""}`}>
        <span className="u-mark pointer-events-none absolute -right-8 -top-6 w-40 text-u-paper/[0.05]" aria-hidden />
        <span
          className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.6875rem] tracking-[0.16em] ${
            isInactive
              ? "border border-u-paper/30 text-u-paper/70"
              : isPending
              ? "border border-dashed border-u-amber text-u-amber"
              : "bg-u-mist text-u-ink"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isInactive ? "bg-u-paper/50" : isPending ? "animate-pulse bg-u-amber" : "bg-u-green"}`} />
          {getStatusDisplay(reservation.status)}
        </span>
        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className={`u-num text-[clamp(3rem,10vw,4.5rem)] font-light leading-none ${isInactive ? "line-through decoration-1" : ""}`}>
              {format(dateObj, "M.d")}
            </span>
            <span className="text-sm text-u-paper/70">{format(dateObj, "（E）", { locale: ja })}</span>
          </div>
          <span className="u-num text-sm text-u-paper/60">{format(dateObj, "yyyy")}</span>
        </div>
        <div className="relative mt-5 flex items-baseline justify-between border-t border-u-paper/15 pt-4">
          <span className="text-xs tracking-[0.16em] text-u-paper/55">時間</span>
          <span className="u-num text-2xl font-light">{formatReservationTime(reservation)}</span>
        </div>
      </div>

      <dl className="mt-6">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b border-u-ink/10 py-3.5 text-sm">
            <dt className="text-xs tracking-[0.14em] text-u-ink/80">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
        {options.length > 0 && (
          <div className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b border-u-ink/10 py-3.5 text-sm">
            <dt className="text-xs tracking-[0.14em] text-u-ink/80">オプション</dt>
            <dd>
              <ul className="space-y-1">
                {options.map((item, index) => {
                  const subtotal = item.total_price ?? (item.option.pricing_type === 'flat'
                    ? (item.option.flat_price || 0)
                    : item.option.pricing_type === 'per_guest'
                    ? item.option.price_per_person * reservation.guest_count
                    : item.option.price_per_person * item.quantity);
                  return (
                    <li key={index} className="flex justify-between gap-3">
                      <span>
                        {item.option.name}
                        {item.option.pricing_type === 'per_person' && ` × ${item.quantity}`}
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

      <div className="mt-5 flex items-end justify-between">
        <span className="text-xs tracking-[0.16em] text-u-ink/80">
          料金（税込）
          {options.length > 0 && <span className="ml-2 text-u-ink/80">オプション {formatPrice(calculateOptionsTotal())} を含む</span>}
        </span>
        <span className="u-num text-[2.25rem] font-light leading-none">{formatPrice(reservation.total_price)}</span>
      </div>
    </div>
  );
};
