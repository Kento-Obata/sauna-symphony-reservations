import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Lock } from "lucide-react";
import { toast } from "sonner";
import { AdminReservationDetailsDialog } from "@/components/admin/AdminReservationDetailsDialog";
import { useRef, useState } from "react";
import { ReservationInfo } from "@/components/reservation/ReservationInfo";
import { ReservationActions } from "@/components/reservation/ReservationActions";

// Square 決済から戻った直後(from=checkout)のポーリング設定。
// Webhook は通常数秒で届く。verifyPayment: true でサーバ経由の Square 照会も併用
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export const ReservationDetail = () => {
  const { code: reservationCode } = useParams();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("t") || undefined;
  const fromCheckout = searchParams.get("from") === "checkout";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const pollStartedAt = useRef<number>(Date.now());

  // Auth state: URL token grants automatic access; phone-verification stores
  // the resulting reservation directly in `phoneVerifiedReservation`.
  // IMPORTANT: derive directly from URL (not useState) so that removing `?t=...`
  // immediately revokes access without relying on stale state.
  const accessToken = tokenFromUrl;
  const [phoneVerifiedReservation, setPhoneVerifiedReservation] = useState<any>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const { data: queryReservation, isLoading: queryLoading, error } = useQuery({
    queryKey: ["reservation", reservationCode, accessToken],
    queryFn: async () => {
      if (!accessToken) return { requiresAuth: true } as any;

      const { data, error } = await supabase.functions.invoke('get-reservation-by-code', {
        // 決済から戻った直後は verifyPayment を付け、Webhook 不達時も
        // サーバが Square に注文状態を照会して確定できるようにする(バックストップ)
        body: { reservationCode, accessToken, verifyPayment: fromCheckout }
      });

      if (error) return { requiresAuth: true } as any;
      if (data?.requiresAuth || data?.error) return { requiresAuth: true } as any;
      return data.reservation;
    },
    retry: false,
    enabled: !!reservationCode && !!accessToken,
    refetchInterval: (query) => {
      // 決済ページから戻った直後だけ、支払い確認が取れるまでポーリングする
      if (!fromCheckout) return false;
      const current = query.state.data as { status?: string } | undefined;
      if (current && current.status !== "pending_payment") return false;
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Effective reservation: phone-verified takes precedence, then query result.
  const reservation = phoneVerifiedReservation ?? queryReservation;
  const isLoading = !phoneVerifiedReservation && !!accessToken && queryLoading;

  const cancelReservation = useMutation({
    mutationFn: async (phoneInput: string) => {
      const { data, error } = await supabase.functions.invoke('cancel-reservation', {
        body: {
          reservationCode: reservationCode,
          phoneLastFourDigits: phoneInput
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      // Refresh whichever source we used to load this reservation.
      if (phoneVerifiedReservation) {
        const { data } = await supabase.functions.invoke('get-reservation-by-code', {
          body: { reservationCode, phoneLastFourDigits: phoneVerifiedReservation.phone?.slice(-4) }
        });
        if (data?.reservation) setPhoneVerifiedReservation(data.reservation);
      } else {
        queryClient.invalidateQueries({ queryKey: ["reservation", reservationCode] });
      }
      toast.success("予約をキャンセルしました");
    },
    onError: (error: Error) => {
      toast.error(error.message || "予約のキャンセルに失敗しました");
    },
  });

  // 早期 return は全ての Hook 呼び出しの後に置く(rules-of-hooks)
  if (!reservationCode) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-500">
          予約コードが見つかりません
        </h1>
        <p className="mt-2 text-gray-600">
          URLをご確認の上、もう一度お試しください。
        </p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          トップページへ戻る
        </Button>
      </div>
    );
  }

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length !== 4) {
      setPhoneError("電話番号の下4桁（数字）を入力してください");
      return;
    }
    setPhoneSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-reservation-by-code', {
        body: { reservationCode, phoneLastFourDigits: digits }
      });
      if (error || !data || data.requiresAuth || data.error || !data.reservation) {
        setPhoneError("認証に失敗しました。電話番号下4桁または予約コードをご確認ください。");
        return;
      }
      setPhoneVerifiedReservation(data.reservation);
    } catch (err: any) {
      setPhoneError(err.message || "認証に失敗しました");
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const needsAuth =
    !phoneVerifiedReservation &&
    (!accessToken || (queryReservation && (queryReservation as any).requiresAuth));

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="container mx-auto p-4">
        <div className="glass-card p-6 max-w-md mx-auto">
          <div className="flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-sauna-stone" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-center">予約内容を表示するには認証が必要です</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            ご予約時にご登録いただいたお電話番号の<br />
            <span className="font-medium">下4桁</span>を入力してください。
          </p>
          <form onSubmit={handlePhoneVerify} className="space-y-4">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-lg tracking-widest"
              autoFocus
            />
            {phoneError && (
              <p className="text-sm text-red-600 text-center">{phoneError}</p>
            )}
            <Button type="submit" className="w-full" disabled={phoneSubmitting}>
              {phoneSubmitting ? "確認中..." : "予約を表示"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/')}
            >
              トップページへ戻る
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            メール・SMSのリンクから開いた場合は自動で表示されます。<br />
            ご不明な場合はお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-500">
            予約情報の取得に失敗しました
          </h1>
          <Button className="mt-4" onClick={() => navigate('/')}>
            トップページへ戻る
          </Button>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-500">
            予約が見つかりませんでした
          </h1>
          <Button className="mt-4" onClick={() => navigate('/')}>
            トップページへ戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="glass-card p-6 max-w-2xl mx-auto relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4"
          onClick={() => navigate('/')}
        >
          <Home className="h-6 w-6 text-sauna-stone" />
        </Button>

        <h1 className="text-3xl font-bold mb-6 text-center text-gradient">
          予約詳細
        </h1>
        
        <div className="space-y-4">
          {reservation.status === "pending_payment" && fromCheckout && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-center">
              {Date.now() - pollStartedAt.current <= POLL_TIMEOUT_MS ? (
                <p className="animate-pulse">お支払いの確認を行っています。このままお待ちください...</p>
              ) : (
                <p>お支払いの確認に時間がかかっています。ページを再読み込みしてご確認ください。</p>
              )}
            </div>
          )}
          <ReservationInfo reservation={reservation} />
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">キャンセルポリシー</p>
            <p>・前日までのキャンセルは無料です。</p>
            <p>・当日のキャンセルはお電話かDMにてご連絡ください。</p>
            {reservation.payment_status === "paid" && (
              <p>・事前決済分は、キャンセル時に全額返金いたします(反映まで数日かかる場合があります)。</p>
            )}
          </div>
          <ReservationActions
            status={reservation.status}
            date={reservation.date}
            paymentStatus={reservation.payment_status}
            setShowEditDialog={setShowEditDialog}
            cancelReservation={cancelReservation}
          />
        </div>
      </div>

      {reservation && (
        <AdminReservationDetailsDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          reservation={reservation}
        />
      )}
    </div>
  );
};

export default ReservationDetail;
