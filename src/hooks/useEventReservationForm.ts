import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PublicEvent, PublicEventSlot } from "@/types/event";
import { extractFunctionErrorMessage } from "@/hooks/useEvent";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";

/**
 * イベント予約フォームのコントローラ（useReservationForm と同型のパターン）。
 * 送信は create-event-reservation edge function。即時確定のため
 * 成功したら /events/complete へ遷移する。
 */
export const useEventReservationForm = (
  event: PublicEvent | undefined,
  slots: PublicEventSlot[],
) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);
  const guestCount = parseInt(people) || 0;
  const totalPrice = event ? event.price_per_person * guestCount : 0;

  // 1回の予約で選べる人数上限（残席とイベント上限の小さい方）
  const maxSelectableGuests = selectedSlot && event
    ? Math.min(selectedSlot.remaining, event.max_guests_per_reservation)
    : 0;

  const validateForm = () => {
    if (!selectedSlot) {
      toast.error("ご希望の枠を選択してください。");
      return false;
    }
    if (selectedSlot.remaining <= 0) {
      toast.error("選択された枠は満席です。別の枠を選択してください。");
      return false;
    }
    if (!name.trim()) {
      toast.error("お名前を入力してください。");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("メールアドレスを入力してください（予約確認メールをお送りします）。");
      return false;
    }
    if (!phone.trim()) {
      toast.error("電話番号を入力してください。");
      return false;
    }
    if (!guestCount) {
      toast.error("人数を選択してください。");
      return false;
    }
    if (guestCount > maxSelectableGuests) {
      toast.error(`この枠でご予約いただける人数は${maxSelectableGuests}名までです。`);
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmReservation = async () => {
    if (!event || !selectedSlot) return;
    try {
      setIsSubmitting(true);

      const { data, error } = await supabase.functions.invoke("create-event-reservation", {
        body: {
          slotId: selectedSlot.id,
          guestName: name.trim(),
          guestCount,
          email: email.trim(),
          phone: phone.trim(),
        },
      });

      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message || "予約の作成に失敗しました");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.reservationCode) throw new Error("予約コードが生成されませんでした。");

      navigate("/events/complete", {
        state: {
          reservationCode: data.reservationCode,
          accessToken: data.accessToken,
          eventTitle: event.title,
          dateLabel: formatEventDateLabel(selectedSlot.date),
          timeLabel: formatEventTimeRange(selectedSlot.start_time, selectedSlot.end_time),
          guestCount,
          totalPrice: data.totalPrice ?? totalPrice,
          priceNote: event.price_note,
        },
        replace: true,
      });
      toast.success("ご予約が確定しました。確認メールをお送りしました。");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "もう一度お試しください";
      console.error("イベント予約の登録に失敗しました:", error);
      toast.error(message);
      setShowConfirmDialog(false);
      setIsSubmitting(false);
      // 満席・残席不足の可能性があるため最新の残席を取り直す
      queryClient.invalidateQueries({ queryKey: ["event", event.slug] });
    }
  };

  return {
    selectedSlotId,
    setSelectedSlotId,
    selectedSlot,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    people,
    setPeople,
    guestCount,
    totalPrice,
    maxSelectableGuests,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
  };
};
