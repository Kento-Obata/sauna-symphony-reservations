import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ReservationConfirm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(true);

  useEffect(() => {
    const confirmReservation = async () => {
      if (!token) {
        console.error("No token provided");
        toast.error("無効な確認リンクです。");
        navigate("/");
        return;
      }

      try {
        console.log("Confirming reservation with token:", token);
        
        const { data, error } = await supabase.functions.invoke("confirm-reservation", {
          body: { token },
        });

        console.log("Response from edge function:", { data, error });

        if (error) {
          throw error;
        }

        if (data?.success) {
          toast.success("予約が確定されました！");
          navigate(`/reservation/${data.reservation_code}`);
        } else {
          toast.error("予約の確定に失敗しました。");
          navigate("/");
        }
      } catch (error) {
        console.error("Error confirming reservation:", error);
        toast.error("予約の確定中にエラーが発生しました。");
        navigate("/");
      } finally {
        setIsConfirming(false);
      }
    };

    confirmReservation();
  }, [token, navigate]);

  if (isConfirming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
        <div className="glass-card p-8">
          <p className="text-lg text-center">予約を確定しています...</p>
        </div>
      </div>
    );
  }

  return null;
}