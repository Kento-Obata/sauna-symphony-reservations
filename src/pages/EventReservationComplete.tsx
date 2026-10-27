import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { StatusTicket, TicketRow } from "@/components/site/StatusTicket";

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

  const detailUrl = `/events/reservation/${reservationCode}${accessToken ? `?t=${accessToken}` : ""}`;

  return (
    <SiteShell minimalFooter>
      <StatusTicket
        state="done"
        latin="Thank you"
        title="ご予約ありがとうございます"
        lead={"ご予約が確定しました\n確認メールをお送りしています\n当日は予約コードをご提示ください"}
        code={reservationCode}
        actions={
          <>
            <Link to={detailUrl} className="u-btn u-btn-primary">
              予約詳細を確認
              <ArrowRight className="u-btn-arrow h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Link to="/events" className="u-btn u-btn-ghost">
              イベント一覧に戻る
            </Link>
          </>
        }
      >
        {eventTitle && <TicketRow label="イベント">{eventTitle}</TicketRow>}
        {dateLabel && (
          <TicketRow label="日時">
            {dateLabel} <span className="u-num text-base">{timeLabel}</span>
          </TicketRow>
        )}
        {guestCount ? <TicketRow label="人数">{guestCount}名</TicketRow> : null}
        {typeof totalPrice === "number" && (
          <TicketRow label="料金">
            <span className="u-num text-2xl font-light">
              {totalPrice > 0 ? `¥${totalPrice.toLocaleString()}` : priceNote || "無料"}
            </span>
            {totalPrice > 0 && <span className="block text-xs text-u-ink/65">{priceNote || "当日現地払い"}</span>}
          </TicketRow>
        )}
      </StatusTicket>
    </SiteShell>
  );
}
