import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/SiteShell";
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
import { supabase } from "@/integrations/supabase/client";
import { EventReservationDetails } from "@/types/event";
import { extractFunctionErrorMessage } from "@/hooks/useEvent";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";
import { getJstTodayYmd } from "@/utils/jstDate";

// 決済ページから戻った直後(from=checkout)のポーリング設定。
// Webhook は通常数秒で届く。verifyPayment: true で Square への直接照会も併用する
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

/**
 * イベント予約詳細 + 自己キャンセル（/events/reservation/:code?t=<access_token>）。
 * 確定メール内のリンク、および Square 決済完了後のリダイレクトで開かれる。
 */
export default function EventReservationDetail() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("t") || "";
  const fromCheckout = searchParams.get("from") === "checkout";
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const pollStartedAt = useRef<number>(Date.now());

  const { data: reservation, isLoading, error } = useQuery<EventReservationDetails>({
    queryKey: ["event-reservation", code],
    enabled: !!code && !!accessToken,
    retry: false,
    refetchInterval: (query) => {
      // 決済から戻った直後だけ、支払い確認が取れるまでポーリングする
      if (!fromCheckout) return false;
      if (query.state.data && query.state.data.status !== "pending_payment") return false;
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) return false;
      return POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-event-reservation", {
        body: {
          reservationCode: code,
          accessToken,
          // Webhook 不達時のバックストップ(サーバが Square へ直接照会して確定する)
          verifyPayment: fromCheckout,
        },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message || "予約情報の取得に失敗しました");
      }
      if (data?.error) throw new Error(data.error);
      return data.reservation as EventReservationDetails;
    },
  });

  // 確定済みは前日まで。決済待ちは金銭の授受が無いためいつでもキャンセル可
  const canCancel = reservation != null &&
    ((reservation.status === "confirmed" && reservation.date > getJstTodayYmd()) ||
      reservation.status === "pending_payment");

  const isPolling = fromCheckout &&
    reservation?.status === "pending_payment" &&
    Date.now() - pollStartedAt.current <= POLL_TIMEOUT_MS;

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      const { data, error } = await supabase.functions.invoke("cancel-event-reservation", {
        body: { reservationCode: code, accessToken },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message || "キャンセルに失敗しました");
      }
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.refunded
          ? "予約をキャンセルしました。返金手続きを行いました"
          : "予約をキャンセルしました",
      );
      queryClient.invalidateQueries({ queryKey: ["event-reservation", code] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "もう一度お試しください";
      toast.error(message);
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const missingToken = !accessToken;
  const isPaid = reservation?.payment_status === "paid";

  const priceLabel = () => {
    if (!reservation) return "";
    if (reservation.total_price <= 0) return reservation.price_note || "無料";
    const amount = `¥${reservation.total_price.toLocaleString()}`;
    if (reservation.payment_status === "refunded") return `${amount}（返金済み）`;
    if (isPaid) return `${amount}（支払済・事前決済）`;
    if (reservation.status === "pending_payment") return `${amount}（お支払い手続き中）`;
    return `${amount}（${reservation.price_note || "当日現地払い"}）`;
  };

  const statusPill = (() => {
    if (!reservation) return null;
    switch (reservation.status) {
      case "cancelled":
        return { label: `キャンセル済み${reservation.payment_status === "refunded" ? "（返金済み）" : ""}`, cls: "border border-u-paper/30 text-u-paper/70", dot: "bg-u-paper/50" };
      case "pending_payment":
        return { label: "お支払い手続き中", cls: "border border-dashed border-u-copper text-u-copper", dot: "animate-pulse bg-u-copper" };
      case "expired":
        return { label: "無効", cls: "border border-u-paper/30 text-u-paper/70", dot: "bg-u-paper/50" };
      case "confirmed":
        return { label: isPaid ? "支払済（事前決済）" : "予約確定", cls: "bg-u-copper text-u-ink", dot: "bg-u-ink" };
      default:
        return null;
    }
  })();
  const isInactive = reservation?.status === "cancelled" || reservation?.status === "expired";

  return (
    <SiteShell minimalFooter>
      {missingToken || error ? (
        <div className="u-container flex flex-col items-center py-24 text-center">
          <span className="u-mark w-12 text-u-ink/25" aria-hidden />
          <h1 className="u-mincho mt-8 text-2xl tracking-[0.1em]">予約情報を表示できません</h1>
          <p className="mt-3 text-sm text-u-ink/80">
            {missingToken
              ? "確認メール内のリンクからアクセスしてください"
              : error instanceof Error
                ? error.message
                : "予約情報の取得に失敗しました"}
          </p>
          <Link to="/events" className="u-btn u-btn-ghost mt-8">
            イベント一覧へ
          </Link>
        </div>
      ) : isLoading || !reservation ? (
        <div className="u-container max-w-2xl py-16">
          <div className="h-56 animate-pulse rounded-[1.5rem] bg-u-ink/10" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-u-ink/[0.06]" />
            ))}
          </div>
        </div>
      ) : (
        <div className="u-container grid gap-10 py-12 md:py-20 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <p className="u-latin text-[clamp(2.5rem,6vw,4rem)] font-light italic leading-none" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
              Reservation
            </p>
            <h1 className="u-mincho mt-4 text-2xl tracking-[0.1em]" style={{ animation: "u-fade-up 1s var(--u-ease) .1s both" }}>
              ご予約内容
            </h1>
          </div>
          <div className="space-y-6 lg:col-span-8" style={{ animation: "u-fade-up 1s var(--u-ease) .15s both" }}>
            {reservation.status === "pending_payment" && (
              <div className="flex items-center gap-3 rounded-2xl border border-u-copper/40 bg-u-copper/[0.08] p-4 text-sm">
                {isPolling && <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-u-copper" />}
                <p>
                  {isPolling
                    ? "お支払いの確認を行っています。このままお待ちください..."
                    : fromCheckout
                      ? "お支払いの確認に時間がかかっています。ページを再読み込みしてご確認ください"
                      : "お支払いが完了すると予約が確定します（お席の確保は20分間です）"}
                </p>
              </div>
            )}
            {reservation.status === "expired" && (
              <div className="rounded-2xl bg-u-ink/[0.05] p-4 text-sm leading-[1.9]">
                <p>
                  お支払いが確認できなかったため、この予約は無効になりました。
                  お手数ですが、空き状況をご確認のうえあらためてご予約ください
                </p>
                <Link to={`/events/${reservation.event_slug}`} className="u-link mt-2 inline-block">
                  イベントページへ →
                </Link>
              </div>
            )}

            <div className={`relative overflow-hidden rounded-[1.5rem] bg-u-ink p-6 text-u-paper sm:p-8 ${isInactive ? "opacity-70" : ""}`}>
              <span className="u-mark pointer-events-none absolute -right-8 -top-6 w-40 text-u-paper/[0.05]" aria-hidden />
              {statusPill && (
                <span className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.6875rem] tracking-[0.16em] ${statusPill.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusPill.dot}`} />
                  {statusPill.label}
                </span>
              )}
              <p className="relative mt-5 text-sm text-u-paper/70">{reservation.event_title}</p>
              <p className="relative mt-2 text-lg">{formatEventDateLabel(reservation.date)}</p>
              <p className={`u-num relative mt-1 text-[clamp(2rem,6vw,3rem)] font-light leading-none ${isInactive ? "line-through decoration-1" : ""}`}>
                {formatEventTimeRange(reservation.start_time, reservation.end_time)}
              </p>
            </div>

            <dl>
              {[
                ...(reservation.event_venue ? [["会場", reservation.event_venue]] : []),
                ["予約コード", reservation.reservation_code],
                ["お名前", `${reservation.guest_name} 様`],
                ["人数", `${reservation.guest_count}名`],
                ["料金", priceLabel()],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6rem_1fr] items-baseline gap-4 border-b border-u-ink/10 py-3.5 text-sm">
                  <dt className="text-xs tracking-[0.14em] text-u-ink/80">{k}</dt>
                  <dd className={k === "予約コード" ? "u-num text-base tracking-[0.08em]" : ""}>{v}</dd>
                </div>
              ))}
            </dl>

            {(reservation.status === "confirmed" || reservation.status === "pending_payment") && (
              <div className="space-y-3 pt-2 sm:text-right">
                {canCancel ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCancelDialog(true)}
                      className="u-btn w-full border border-[hsl(4_62%_42%/0.4)] text-[hsl(4,62%,42%)] hover:bg-[hsl(4,62%,42%)] hover:text-u-paper sm:w-auto"
                    >
                      予約をキャンセル
                    </button>
                    {isPaid && (
                      <p className="text-xs text-u-ink/80">キャンセルの場合、お支払いいただいた料金は全額返金されます</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-u-ink/80">当日以降のキャンセルはお電話にてご連絡ください</p>
                )}
              </div>
            )}

            <div className="pt-4">
              <Link to="/events" className="u-link text-sm text-u-ink/80">
                イベント一覧へ
              </Link>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="u-site w-[calc(100%-1.5rem)] rounded-[1.5rem] border-0 bg-u-paper sm:rounded-[1.5rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="u-mincho font-medium tracking-[0.08em]">予約をキャンセルしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPaid
                ? "お支払いいただいた料金は全額返金いたします（カード会社により反映まで数日かかる場合があります）。この操作は取り消せません"
                : "この操作は取り消せません。再度ご参加いただく場合は、あらためてご予約ください"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling} className="rounded-full">戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={isCancelling}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "処理中..." : "キャンセルする"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SiteShell>
  );
}
