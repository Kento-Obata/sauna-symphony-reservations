import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
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
    return <DetailMessage title="予約コードが見つかりません" body="URLをご確認の上、もう一度お試しください" />;
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
        setPhoneError("認証に失敗しました。電話番号下4桁または予約コードをご確認ください");
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
      <SiteShell minimalFooter>
        <div className="u-container max-w-2xl py-16">
          <div className="h-56 animate-pulse rounded-[1.5rem] bg-u-ink/10" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-u-ink/[0.06]" />
            ))}
          </div>
        </div>
      </SiteShell>
    );
  }

  if (needsAuth) {
    return (
      <SiteShell minimalFooter>
        <div className="u-container flex justify-center py-16 md:py-24">
          <div className="w-full max-w-md text-center" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-u-ink/20">
              <Lock className="h-5 w-5" strokeWidth={1.4} />
            </span>
            <p className="u-latin mt-6 text-xl italic text-u-ink/80">Verify</p>
            <h1 className="u-mincho mt-2 text-2xl tracking-[0.1em]">ご本人確認</h1>
            <p className="mt-4 text-sm leading-[2] text-u-ink/80">
              ご予約時のお電話番号の<strong className="font-medium text-u-ink">下4桁</strong>を入力してください
            </p>
            <form onSubmit={handlePhoneVerify} className="mt-8 space-y-4">
              <div className="flex justify-center gap-2" onClick={() => document.getElementById("phone-last4")?.focus()}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <span
                    key={i}
                    className={`u-num flex h-16 w-14 items-center justify-center rounded-2xl border text-3xl font-light transition-colors ${
                      phoneInput.length === i ? "border-u-ink bg-white" : "border-u-ink/15 bg-white/50"
                    }`}
                  >
                    {phoneInput[i] ?? ""}
                  </span>
                ))}
              </div>
              <input
                id="phone-last4"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                aria-label="電話番号の下4桁"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="sr-only"
                autoFocus
              />
              {phoneError && <p className="text-sm text-[hsl(var(--destructive))]">{phoneError}</p>}
              <button type="submit" className="u-btn u-btn-primary w-full" disabled={phoneSubmitting || phoneInput.length !== 4}>
                {phoneSubmitting ? "確認中…" : "予約を表示"}
              </button>
              <Link to="/" className="u-btn w-full text-u-ink/80 hover:text-u-ink">
                トップページへ戻る
              </Link>
            </form>
            <p className="mt-6 text-xs leading-[1.9] text-u-ink/80">
              メール・SMSのリンクから開いた場合は自動で表示されます
            </p>
          </div>
        </div>
      </SiteShell>
    );
  }

  if (error) {
    return <DetailMessage title="予約情報の取得に失敗しました" body="時間をおいて、もう一度お試しください" />;
  }

  if (!reservation) {
    return <DetailMessage title="予約が見つかりませんでした" body="予約コードをご確認ください" />;
  }

  return (
    <SiteShell minimalFooter>
      <div className="u-container grid gap-10 py-12 md:py-20 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <p className="u-latin text-[clamp(2.5rem,6vw,4rem)] font-light italic leading-none" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
            Reservation
          </p>
          <h1 className="u-mincho mt-4 text-2xl tracking-[0.1em]" style={{ animation: "u-fade-up 1s var(--u-ease) .1s both" }}>
            予約詳細
          </h1>
          <div className="mt-8 hidden space-y-2 text-xs leading-[1.9] text-u-ink/80 lg:block">
            <p>当日は開始時刻の10分前からご案内いたします</p>
            <p>
              ご不明点は
              <a href="https://www.instagram.com/u__sauna/" target="_blank" rel="noopener noreferrer" className="u-link mx-1 text-u-ink">
                Instagram
              </a>
              のDMへどうぞ
            </p>
          </div>
        </div>
        <div className="space-y-6 lg:col-span-8" style={{ animation: "u-fade-up 1s var(--u-ease) .15s both" }}>
          {reservation.status === "pending_payment" && fromCheckout && (
            <div className="flex items-center gap-3 rounded-2xl border border-u-copper/40 bg-u-copper/[0.08] p-4 text-sm">
              {Date.now() - pollStartedAt.current <= POLL_TIMEOUT_MS ? (
                <>
                  <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-u-copper" />
                  <p>お支払いの確認を行っています。このままお待ちください…</p>
                </>
              ) : (
                <p>お支払いの確認に時間がかかっています。ページを再読み込みしてご確認ください</p>
              )}
            </div>
          )}
          <ReservationInfo reservation={reservation} />
          <div className="rounded-2xl bg-u-ink/[0.04] p-5 text-xs leading-[1.9] text-u-ink/80">
            <p className="mb-1 text-[0.6875rem] tracking-[0.2em] text-u-ink/80">キャンセルポリシー</p>
            <p>・2日前までのキャンセルは無料</p>
            <p>・24時間前までは料金の30%、24時間以内・無断キャンセルは料金の100%を申し受けます</p>
            <p>・このページからのキャンセルは2日前まで。前日・当日はお電話かDMにてご連絡ください</p>
            {reservation.payment_status === "paid" && (
              <p>・事前決済分は、2日前までのキャンセルで全額返金いたします(反映まで数日かかる場合があります)</p>
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
    </SiteShell>
  );
};

const DetailMessage = ({ title, body }: { title: string; body: string }) => (
  <SiteShell minimalFooter>
    <div className="u-container flex flex-col items-center py-24 text-center">
      <span className="u-mark w-12 text-u-ink/30" aria-hidden />
      <h1 className="u-mincho mt-8 text-2xl tracking-[0.1em]">{title}</h1>
      <p className="mt-3 text-sm text-u-ink/80">{body}</p>
      <Link to="/" className="u-btn u-btn-ghost mt-8">
        トップページへ戻る
      </Link>
    </div>
  </SiteShell>
);

export default ReservationDetail;
