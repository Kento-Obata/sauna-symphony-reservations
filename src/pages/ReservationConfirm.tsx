import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function ReservationConfirm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmReservation = async () => {
      if (!token) {
        console.error("No token provided");
        setError("無効な確認トークンです。");
        setIsLoading(false);
        return;
      }

      try {
        console.log("Confirming reservation with token:", token);
        
        // First, check if the reservation exists
        const { data: existingReservation } = await supabase
          .from("reservations")
          .select("*")
          .eq("confirmation_token", token)
          .single();

        console.log("Existing reservation:", existingReservation);

        const { data, error } = await supabase.functions.invoke("confirm-reservation", {
          body: { token },
        });

        console.log("Confirmation response:", data, error);

        if (error) throw error;

        if (data.success && data.reservation_code) {
          console.log("Reservation confirmed successfully:", data.reservation_code);
          navigate(`/reservation/complete`, { 
            state: { reservationCode: data.reservation_code },
            replace: true
          });
        } else {
          throw new Error("予約の確認に失敗しました。");
        }
      } catch (err) {
        console.error("Reservation confirmation error:", err);
        setError("予約の確認に失敗しました。時間が経過している可能性があります。");
        setIsLoading(false);
      }
    };

    confirmReservation();
  }, [token, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
        <div className="glass-card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>予約を確認中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
        <div className="glass-card p-8 max-w-2xl w-full mx-4">
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold text-red-500">エラー</h1>
            <p className="text-sauna-stone">{error}</p>
            <Button 
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              トップページに戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}