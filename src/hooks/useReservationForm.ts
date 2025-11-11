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
import { ReservationOption } from "@/types/option";

export const useReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  // 水温を常に15°Cに固定
  const [temperature, setTemperature] = useState("15");
  const [selectedOptions, setSelectedOptions] = useState<ReservationOption[]>([]);
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
    setSelectedOptions([]);
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

      const guestCount = parseInt(people);
      
      console.log("Creating reservation via edge function");

      // Call the create-reservation edge function
      const { data, error } = await supabase.functions.invoke('create-reservation', {
        body: {
          date: format(date!, "yyyy-MM-dd"),
          timeSlot: timeSlot as TimeSlot,
          guestName: name,
          guestCount: guestCount,
          email: email || null,
          phone: phone,
          waterTemperature: 15, // 水温を常に15°Cに固定
          selectedOptions: selectedOptions
        }
      });

      if (error) {
        console.error("Error creating reservation:", error);
        throw error;
      }

      if (data?.error) {
        console.error("Reservation creation error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.reservationCode) {
        throw new Error("予約コードが生成されませんでした。");
      }

      setReservationCode(data.reservationCode);

      // Navigate to temporary reservation page
      navigate('/reservation/pending', { 
        state: { reservationCode: data.reservationCode },
        replace: true
      });

      toast.success("仮予約を受け付けました。メールまたはSMSの確認リンクから予約を確定してください。");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error: any) {
      console.error("予約の登録に失敗しました:", error);
      toast.error(`予約の登録に失敗しました: ${error.message || 'もう一度お試しください'}`);
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
    selectedOptions,
    setSelectedOptions,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
    reservationCode,
  };
};
