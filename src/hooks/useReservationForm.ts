import { useState } from "react";
import { TimeSlot } from "@/types/reservation";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const queryClient = useQueryClient();

  const resetForm = () => {
    setDate(undefined);
    setTimeSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setPeople("");
    setTemperature("");
    setShowConfirmDialog(false);
  };

  const validateForm = () => {
    if (!date || !isValid(date)) {
      toast.error("有効な日付を選択してください。");
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
    if (!temperature) {
      toast.error("水風呂温度を選択してください。");
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

  const handleConfirmReservation = async (paymentMethod: "cash" | "online") => {
    try {
      if (!date || !isValid(date)) {
        toast.error("無効な日付です。");
        return;
      }

      const reservationData = {
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot as TimeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
      };

      // Check for existing reservations
      const { data: existingReservations } = await supabase
        .from("reservations")
        .select("*")
        .eq("date", reservationData.date)
        .eq("time_slot", reservationData.time_slot);

      if (existingReservations && existingReservations.length > 0) {
        toast.error("申し訳ありませんが、この時間帯はすでに予約が入っています。");
        return;
      }

      if (paymentMethod === "online") {
        // Store reservation data in localStorage before redirect
        localStorage.setItem('pendingReservation', JSON.stringify(reservationData));
        window.location.href = "https://square.link/u/w4KjWD66";
        return;
      }

      // For cash payment, directly insert the reservation
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

      toast.success("予約を受け付けました");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error) {
      console.error("予約の登録に失敗しました:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
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
  };
};