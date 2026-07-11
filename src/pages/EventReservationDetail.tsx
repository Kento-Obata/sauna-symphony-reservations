import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

/**
 * イベント予約詳細 + 自己キャンセル（/events/reservation/:code?t=<access_token>）。
 * 確定メール内のリンクからアクセスされる。トークンなしでは照会できない。
 */
export default function EventReservationDetail() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("t") || "";
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: reservation, isLoading, error } = useQuery<EventReservationDetails>({
    queryKey: ["event-reservation", code],
    enabled: !!code && !!accessToken,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-event-reservation", {
        body: { reservationCode: code, accessToken },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message || "予約情報の取得に失敗しました");
      }
      if (data?.error) throw new Error(data.error);
      return data.reservation as EventReservationDetails;
    },
  });

  const todayYmd = () => {
    const now = new Date();
    // 端末ローカルではなく JST 基準の暦日で判定する
    return new Date(now.getTime() + (now.getTimezoneOffset() + 9 * 60) * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  };

  const canCancel =
    reservation?.status === "confirmed" && reservation.date > todayYmd();

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
      toast.success("予約をキャンセルしました");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10 py-12">
      <div className="glass-card p-8 max-w-2xl w-full mx-4">
        {missingToken || error ? (
          <div className="text-center space-y-4">
            <h1 className="text-xl font-bold">予約情報を表示できません</h1>
            <p className="text-sauna-stone text-sm">
              {missingToken
                ? "確認メール内のリンクからアクセスしてください。"
                : error instanceof Error
                  ? error.message
                  : "予約情報の取得に失敗しました。"}
            </p>
            <Link to="/events" className="inline-block underline text-sm">
              イベント一覧へ →
            </Link>
          </div>
        ) : isLoading || !reservation ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse h-4 w-32 bg-sauna-stone/10 rounded"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-gradient">ご予約内容</h1>
              {reservation.status === "cancelled" && (
                <p className="inline-block bg-red-50 text-red-600 text-sm px-4 py-1 rounded-full">
                  キャンセル済み
                </p>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">イベント</span>
                <span className="font-medium">{reservation.event_title}</span>
              </div>
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">日時</span>
                <span className="font-medium">
                  {formatEventDateLabel(reservation.date)}{" "}
                  {formatEventTimeRange(reservation.start_time, reservation.end_time)}
                </span>
              </div>
              {reservation.event_venue && (
                <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                  <span className="text-sauna-stone">会場</span>
                  <span className="font-medium">{reservation.event_venue}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">予約コード</span>
                <span className="font-medium">{reservation.reservation_code}</span>
              </div>
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">お名前</span>
                <span className="font-medium">{reservation.guest_name} 様</span>
              </div>
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">人数</span>
                <span className="font-medium">{reservation.guest_count}名</span>
              </div>
              <div className="flex justify-between border-b border-sauna-stone/10 pb-2">
                <span className="text-sauna-stone">料金</span>
                <span className="font-medium">
                  {reservation.total_price > 0
                    ? `¥${reservation.total_price.toLocaleString()}（${reservation.price_note || "当日現地払い"}）`
                    : reservation.price_note || "無料"}
                </span>
              </div>
            </div>

            {reservation.status === "confirmed" && (
              <div className="text-center space-y-3 pt-2">
                {canCancel ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    予約をキャンセル
                  </Button>
                ) : (
                  <p className="text-xs text-sauna-stone">
                    当日以降のキャンセルはお電話にてご連絡ください。
                  </p>
                )}
              </div>
            )}

            <div className="text-center">
              <Link to="/events" className="text-sm underline text-sauna-stone">
                イベント一覧へ
              </Link>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約をキャンセルしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。再度ご参加いただく場合は、あらためてご予約ください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "処理中..." : "キャンセルする"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
