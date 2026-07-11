import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * イベント予約完了ページ。即時確定のため、遷移元 state の情報をそのまま表示する。
 * メール不達時の救済のため、予約コードと詳細リンクを必ず表示する。
 */
export default function EventReservationComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    reservationCode,
    accessToken,
    eventTitle,
    dateLabel,
    timeLabel,
    guestCount,
    totalPrice,
    priceNote,
  } = location.state ?? {};

  useEffect(() => {
    if (!reservationCode) navigate("/events", { replace: true });
  }, [reservationCode, navigate]);

  if (!reservationCode) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
      <div className="glass-card p-8 max-w-2xl w-full mx-4">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-gradient">ご予約ありがとうございます</h1>

          <div className="space-y-2">
            {eventTitle && <p className="text-lg">{eventTitle}</p>}
            {dateLabel && (
              <p className="text-sauna-stone">
                {dateLabel} {timeLabel}
                {guestCount ? ` ・ ${guestCount}名` : ""}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-lg">予約コード</p>
            <p className="text-2xl font-bold">{reservationCode}</p>
          </div>

          {typeof totalPrice === "number" && (
            <div className="space-y-1">
              <p className="text-lg">料金</p>
              <p className="text-2xl font-bold">
                {totalPrice > 0 ? `¥${totalPrice.toLocaleString()}` : priceNote || "無料"}
              </p>
              {totalPrice > 0 && (
                <p className="text-sm text-sauna-stone">
                  {priceNote || "当日現地払い"}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 text-sauna-stone">
            <p>ご予約が確定しました。確認メールをお送りしています。</p>
            <p>当日は予約コードをご提示ください。</p>
          </div>

          <div className="space-y-4 pt-6">
            <Button
              onClick={() =>
                navigate(
                  `/events/reservation/${reservationCode}${accessToken ? `?t=${accessToken}` : ""}`,
                )
              }
              className="w-full sm:w-auto"
            >
              予約詳細を確認
            </Button>
            <div>
              <Button
                variant="outline"
                onClick={() => navigate("/events")}
                className="w-full sm:w-auto"
              >
                イベント一覧に戻る
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
