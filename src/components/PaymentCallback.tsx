import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const PaymentCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handlePaymentCallback = async () => {
      const pendingReservationStr = localStorage.getItem('pendingReservation');
      
      if (!pendingReservationStr) {
        toast.error("予約情報が見つかりませんでした。");
        navigate('/');
        return;
      }

      try {
        const reservationData = JSON.parse(pendingReservationStr);

        const { error } = await supabase
          .from("reservations")
          .insert(reservationData);

        if (error) throw error;

        const notificationResponse = await supabase.functions.invoke(
          "send-reservation-notification",
          {
            body: {
              date: reservationData.date,
              timeSlot: reservationData.time_slot,
              guestName: reservationData.guest_name,
              guestCount: reservationData.guest_count,
              email: reservationData.email,
              phone: reservationData.phone,
              waterTemperature: reservationData.water_temperature,
            },
          }
        );

        if (notificationResponse.error) {
          console.error("通知の送信に失敗しました:", notificationResponse.error);
          toast.error("予約は完了しましたが、通知の送信に失敗しました。");
        }

        toast.success("予約が完了しました！");
        localStorage.removeItem('pendingReservation');
        navigate('/');
      } catch (error) {
        console.error("予約の登録に失敗しました:", error);
        toast.error("予約の登録に失敗しました。もう一度お試しください。");
        navigate('/');
      }
    };

    handlePaymentCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">決済処理中...</h2>
        <p>しばらくお待ちください。</p>
      </div>
    </div>
  );
};