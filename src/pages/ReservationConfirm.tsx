
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
        console.log("Starting reservation confirmation process");
        console.log("Token:", token);
        
        // First check if the reservation exists and is not expired
        const { data: reservation, error: fetchError } = await supabase
          .from("reservations")
          .select("*")
          .eq("confirmation_token", token)
          .single();

        console.log("Fetched reservation:", reservation);
        console.log("Fetch error:", fetchError);

        if (fetchError || !reservation) {
          console.error("Error fetching reservation:", fetchError);
          toast.error("予約が見つからないか、有効期限が切れています。");
          navigate("/");
          return;
        }

        // Call the edge function
        console.log("Calling confirm-reservation edge function");
        const { data, error } = await supabase.functions.invoke("confirm-reservation", {
          body: { token },
        });

        console.log("Edge function response:", { data, error });

        if (error) {
          console.error("Edge function error:", error);
          throw error;
        }

        if (data?.success) {
          console.log("Reservation confirmed successfully");

          // Send confirmation notification
          const notificationResponse = await supabase.functions.invoke(
            "send-confirmation-notification",
            {
              body: {
                date: reservation.date,
                timeSlot: reservation.time_slot,
                guestName: reservation.guest_name,
                guestCount: reservation.guest_count,
                email: reservation.email,
                phone: reservation.phone,
                waterTemperature: reservation.water_temperature,
                reservationCode: data.reservation_code,
                total_price: reservation.total_price, // 合計価格を通知データに含める
              },
            }
          );

          if (notificationResponse.error) {
            console.error("確認通知の送信に失敗しました:", notificationResponse.error);
            toast.error("予約は確定されましたが、確認通知の送信に失敗しました。");
          }

          toast.success("予約が確定されました！");
          navigate(`/reservation/${data.reservation_code}`);
        } else {
          console.error("Edge function returned success: false");
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
