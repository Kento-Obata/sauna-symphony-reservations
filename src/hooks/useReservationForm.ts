
import { useState } from "react";
import { TimeSlot } from "@/types/reservation";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useShopClosures } from "@/hooks/useShopClosures";
import { isShopClosed } from "@/utils/dateUtils";
import { getTotalPrice } from "@/utils/priceCalculations";

export const useReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  // 水温を常に15°Cに固定
  const [temperature, setTemperature] = useState("15");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationCode, setReservationCode] = useState<string>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { closures } = useShopClosures();

  const resetForm = () => {
    setDate(undefined);
    setTimeSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setPeople("");
    // リセット時も15°Cに固定
    setTemperature("15");
    setShowConfirmDialog(false);
    setIsSubmitting(false);
    setReservationCode(undefined);
  };

  const validateForm = () => {
    if (!date || !isValid(date)) {
      toast.error("有効な日付を選択してください。");
      return false;
    }

    // 休業日チェックを追加
    if (isShopClosed(date, closures)) {
      toast.error("選択された日付は休業日です。別の日を選択してください。");
      return false;
    }

    if (!timeSlot) {
      toast.error("時間帯を選択してください。");
      return false;
    }
    if (!name) {
      toast.error("お名前を入力してください。");
      return false;
    }
    if (!phone) {
      toast.error("電話番号を入力してください。");
      return false;
    }
    if (!people) {
      toast.error("人数を選択してください。");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmReservation = async () => {
    try {
      setIsSubmitting(true);

      if (!date || !isValid(date)) {
        toast.error("無効な日付です。");
        return;
      }

      // 予約確定前に再度休業日チェック
      if (isShopClosed(date, closures)) {
        toast.error("選択された日付は休業日です。別の日を選択してください。");
        setIsSubmitting(false);
        return;
      }

      // Calculate total price before creating the reservation
      const totalPrice = await getTotalPrice(
        parseInt(people),
        temperature,
        date
      );
      
      console.log("Calculated total price:", totalPrice);

      const reservationData = {
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot as TimeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        // 水温を常に15°Cに固定
        water_temperature: 15,
        status: "pending" as const,
        // Include the total price in the reservation data
        total_price: totalPrice
      };

      console.log("Submitting reservation data:", reservationData);

      // Check for existing confirmed reservations
      const { data: existingReservations, error: checkError } = await supabase
        .from("reservations")
        .select("*")
        .eq("date", reservationData.date)
        .eq("time_slot", reservationData.time_slot)
        .eq("status", "confirmed");

      if (checkError) {
        console.error("Error checking existing reservations:", checkError);
        throw checkError;
      }

      if (existingReservations && existingReservations.length > 0) {
        toast.error("申し訳ありませんが、この時間帯はすでに予約が入っています。");
        setIsSubmitting(false);
        return;
      }

      // Insert the reservation
      const { data: newReservation, error } = await supabase
        .from("reservations")
        .insert(reservationData)
        .select()
        .single();

      if (error) {
        console.error("Error inserting reservation:", error);
        throw error;
      }

      if (!newReservation?.reservation_code || !newReservation.confirmation_token) {
        throw new Error("予約コードまたは確認トークンが生成されませんでした。");
      }

      setReservationCode(newReservation.reservation_code);

      // Send pending notification
      // 重要な修正: ここでtotal_priceを追加
      const notificationResponse = await supabase.functions.invoke(
        "send-pending-notification",
        {
          body: {
            date: reservationData.date,
            timeSlot: reservationData.time_slot,
            guestName: reservationData.guest_name,
            guestCount: reservationData.guest_count,
            email: reservationData.email,
            phone: reservationData.phone,
            waterTemperature: reservationData.water_temperature,
            reservationCode: newReservation.reservation_code,
            confirmationToken: newReservation.confirmation_token,
            reservationDate: date.toISOString(),
            total_price: newReservation.total_price // 修正: データベースに保存された料金を渡す
          },
        }
      );

      if (notificationResponse.error) {
        console.error("通知の送信に失敗しました:", notificationResponse.error);
        toast.error("予約は完了しましたが、通知の送信に失敗しました。");
      }

      // Navigate to temporary reservation page
      navigate('/reservation/pending', { 
        state: { reservationCode: newReservation.reservation_code },
        replace: true
      });

      toast.success("仮予約を受け付けました。メールまたはSMSの確認リンクから予約を確定してください。");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error) {
      console.error("予約の登録に失敗しました:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
      setIsSubmitting(false);
    }
  };

  return {
    date,
    setDate,
    timeSlot,
    setTimeSlot,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    people,
    setPeople,
    temperature,
    setTemperature,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
    reservationCode,
  };
};
