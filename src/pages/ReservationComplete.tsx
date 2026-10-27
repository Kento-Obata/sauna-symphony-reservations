
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { StatusTicket, TicketNote, TicketRow } from "@/components/site/StatusTicket";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";
import { formatPrice } from "@/utils/priceCalculations";

interface ReservationDetails {
  total_price: number;
  options?: {
    option: Option;
    quantity: number;
  }[];
}

export default function ReservationComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = location.state?.reservationCode;
  const accessToken = location.state?.accessToken;
  const [details, setDetails] = useState<ReservationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationCode) {
      navigate('/');
      return;
    }

    // 予約詳細とオプション情報を取得
    const fetchReservationDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use edge function to securely fetch reservation (auth via accessToken)
        const { data: reservationData, error: reservationError } = await supabase.functions.invoke('get-reservation-by-code', {
          body: { reservationCode, accessToken }
        });

        if (reservationError || reservationData?.error) {
          console.error("予約情報取得エラー:", reservationError || reservationData?.error);
          setError("予約情報の取得に失敗しました");
          return;
        }

        const reservation = reservationData.reservation;
        if (!reservation) {
          console.error("予約情報が見つかりません");
          setError("予約情報の取得に失敗しました");
          return;
        }

        // 予約オプション情報を取得
        const { data: reservationOptions, error: optionsError } = await supabase
          .from("reservation_options")
          .select(`
            quantity,
            option_id,
            options:option_id (
              id, name, description, price_per_person, pricing_type, flat_price, is_active
            )
          `)
          .eq("reservation_id", reservation.id);

        if (optionsError) {
          console.error("オプション取得エラー:", optionsError);
          // オプション取得エラーの場合はオプションなしで続行
        }

        console.log("取得したオプション情報:", reservationOptions);

        // オプション情報を整形
        const formattedOptions = reservationOptions?.map((item: any) => {
          if (!item.options) {
            console.log("オプションが見つかりません:", item);
            return null;
          }
          return {
            option: item.options as Option,
            quantity: item.quantity
          };
        }).filter(Boolean) || [];

        setDetails({
          total_price: reservation.total_price,
          options: formattedOptions.length > 0 ? formattedOptions : undefined
        });
      } catch (err) {
        console.error("詳細情報取得エラー:", err);
        setError("予約情報の取得中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservationDetails();
  }, [reservationCode, accessToken, navigate]);

  if (!reservationCode) return null;

  const detailUrl = `/reservation/${reservationCode}${accessToken ? `?t=${accessToken}` : ""}`;

  return (
    <SiteShell minimalFooter>
      <StatusTicket
        state="done"
        latin="Thank you"
        title="ご予約ありがとうございます"
        lead={"ご予約が確定しました\n確認のご連絡をお送りしています\n当日は予約コードをご提示ください"}
        code={reservationCode}
        actions={
          <>
            <Link to={detailUrl} className="u-btn u-btn-primary">
              予約詳細を確認
              <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Link to="/" className="u-btn u-btn-ghost">
              トップページに戻る
            </Link>
          </>
        }
      >
        {error && <TicketNote tone="warn">{error}</TicketNote>}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-5 animate-pulse rounded bg-u-ink/[0.06]" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-u-ink/[0.06]" />
          </div>
        ) : (
          details && (
            <>
              {details.options?.map((item, index) => (
                <TicketRow key={index} label={item.option.name}>
                  <span className="u-num">
                    {formatPrice(item.option.price_per_person)} × {item.quantity}名様
                  </span>
                </TicketRow>
              ))}
              <TicketRow label="料金">
                <span className="u-num text-2xl font-light">{formatPrice(details.total_price)}</span>
              </TicketRow>
            </>
          )
        )}
        <TicketNote>受付は、ご予約時間の10分前から開始します</TicketNote>
      </StatusTicket>
    </SiteShell>
  );
}
