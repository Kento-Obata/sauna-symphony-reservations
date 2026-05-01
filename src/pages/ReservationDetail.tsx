import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Lock } from "lucide-react";
import { toast } from "sonner";
import { AdminReservationDetailsDialog } from "@/components/admin/AdminReservationDetailsDialog";
import { useState } from "react";
import { ReservationInfo } from "@/components/reservation/ReservationInfo";
import { ReservationActions } from "@/components/reservation/ReservationActions";

export const ReservationDetail = () => {
  const { code: reservationCode } = useParams();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("t") || undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Auth state: we hold either the URL token or, after a successful
  // phone-last-4 verification, the canonical access token returned by the server.
  const [accessToken, setAccessToken] = useState<string | undefined>(tokenFromUrl);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const { data: reservation, isLoading, error, refetch } = useQuery({
    queryKey: ["reservation", reservationCode, accessToken],
    queryFn: async () => {
      // Without auth credentials, do not even attempt — show the auth gate.
      if (!accessToken) return { requiresAuth: true } as any;

      const { data, error } = await supabase.functions.invoke('get-reservation-by-code', {
        body: { reservationCode, accessToken }
      });

      if (error) {
        // 401 from the function is delivered as an invocation error in some cases
        return { requiresAuth: true } as any;
      }
      if (data?.requiresAuth || data?.error) {
        return { requiresAuth: true } as any;
      }
      return data.reservation;
    },
    retry: false,
    enabled: !!reservationCode,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationCode] });
      toast.success("予約をキャンセルしました");
    },
    onError: (error: Error) => {
      toast.error(error.message || "予約のキャンセルに失敗しました");
    },
  });

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
      // Cache the reservation under a synthetic auth key so subsequent reads work.
      queryClient.setQueryData(["reservation", reservationCode, "phone"], data.reservation);
      // Re-render with reservation manually injected via accessToken sentinel.
      setAccessToken("__phone_verified__");
      queryClient.setQueryData(["reservation", reservationCode, "__phone_verified__"], data.reservation);
    } catch (err: any) {
      setPhoneError(err.message || "認証に失敗しました");
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const needsAuth =
    !accessToken ||
    (reservation && (reservation as any).requiresAuth);

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
          <ReservationInfo reservation={reservation} />
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">キャンセルポリシー</p>
            <p>・前日までのキャンセルは無料です。</p>
            <p>・当日のキャンセルはお電話かDMにてご連絡ください。</p>
          </div>
          <ReservationActions 
            status={reservation.status}
            date={reservation.date}
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
