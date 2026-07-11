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
  // 'onsite'(現地払い・従来フロー) / 'square_online'(事前決済: 支払い完了で確定)
  // 既定は事前決済(オーナー要望 2026-07-11)
  const [paymentMethod, setPaymentMethod] = useState<"onsite" | "square_online">("square_online");
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
    setPaymentMethod("square_online");
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
          paymentMethod,
          selectedOptions: selectedOptions
        }
      });

      if (error) {
        console.error("Error creating reservation:", error);
        // 非2xx(満席409等)はサーバのエラーメッセージを取り出して表示する
        let serverMessage: string | null = null;
        const context = (error as { context?: Response })?.context;
        if (context && typeof context.json === "function") {
          try {
            const body = await context.clone().json();
            if (typeof body?.error === "string") serverMessage = body.error;
          } catch {
            // JSON でないレスポンスは無視
          }
        }
        throw serverMessage ? new Error(serverMessage) : error;
      }

      if (data?.error) {
        console.error("Reservation creation error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.reservationCode) {
        throw new Error("予約コードが生成されませんでした。");
      }

      setReservationCode(data.reservationCode);

      if (data.checkout && data.checkoutUrl) {
        // 事前決済: Square のホスト型決済ページへ全画面遷移する。
        // isSubmitting は true のまま(戻るまでボタンを閉じておく)
        window.location.assign(data.checkoutUrl);
        return;
      }

      // Navigate to temporary reservation page
      navigate('/reservation/pending', {
        state: { reservationCode: data.reservationCode, accessToken: data.accessToken },
        replace: true
      });

      toast.success("仮予約を受け付けました。メールまたはSMSの確認リンクから予約を確定してください。");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error) {
      console.error("予約の登録に失敗しました:", error);
      const message = error instanceof Error && error.message ? error.message : "もう一度お試しください";
      toast.error(`予約の登録に失敗しました: ${message}`);
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
    paymentMethod,
    setPaymentMethod,
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
