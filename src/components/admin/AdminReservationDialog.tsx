import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { TimeSlot } from "@/types/reservation";
import { ReservationDetails } from "@/components/reservation/ReservationDetails";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ReservationCalendar } from "@/components/reservation/ReservationCalendar";
import { useReservations } from "@/hooks/useReservations";
import { useShopClosures } from "@/hooks/useShopClosures";
import { isShopClosed } from "@/utils/dateUtils";
import { ReservationOption } from "@/types/option";
import { ReservationOptions } from "@/components/reservation/ReservationOptions";
import { getTotalPrice } from "@/utils/priceCalculations";

interface AdminReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date | null;
  defaultTimeSlot?: TimeSlot | null;
}

export const AdminReservationDialog = ({
  open,
  onOpenChange,
  defaultDate,
  defaultTimeSlot,
}: AdminReservationDialogProps) => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(defaultDate || undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">(defaultTimeSlot || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  // 水温は常に15°Cに固定
  const [temperature, setTemperature] = useState("15");
  const [selectedOptions, setSelectedOptions] = useState<ReservationOption[]>([]);
  const [timeSlotReservations, setTimeSlotReservations] = useState<Record<TimeSlot, number>>({
    morning: 0,
    afternoon: 0,
    evening: 0,
  });

  const { data: reservations } = useReservations();
  const { closures } = useShopClosures();

  useEffect(() => {
    if (date) {
      const fetchReservations = async () => {
        const { data: reservations } = await supabase
          .from("reservations")
          .select("*")
          .eq("date", format(date, "yyyy-MM-dd"));

        if (reservations) {
          const counts: Record<TimeSlot, number> = {
            morning: 0,
            afternoon: 0,
            evening: 0,
          };

          reservations.forEach((reservation) => {
            counts[reservation.time_slot as TimeSlot]++;
          });

          setTimeSlotReservations(counts);
        }
      };

      fetchReservations();
    }
  }, [date]);

  // Update date when defaultDate changes
  useEffect(() => {
    if (defaultDate) {
      setDate(defaultDate);
    }
  }, [defaultDate]);

  // Update timeSlot when defaultTimeSlot changes
  useEffect(() => {
    if (defaultTimeSlot) {
      setTimeSlot(defaultTimeSlot);
    }
  }, [defaultTimeSlot]);

  const handleSubmit = async () => {
    // デバッグ用のログを追加
    console.log('Submit values:', {
      date,
      timeSlot,
      name,
      phone,
      email,
      people,
      temperature: "15", // 常に15°Cに固定
      selectedOptions
    });

    if (!date || !timeSlot || !name || !phone || !people) {
      console.log('Missing fields:', {
        date: !date,
        timeSlot: !timeSlot,
        name: !name,
        phone: !phone,
        people: !people
      });
      toast.error("必須項目をすべて入力してください。");
      return;
    }

    // 休業日チェックを追加
    if (isShopClosed(date, closures)) {
      toast.error("選択された日付は休業日です。別の日を選択してください。");
      return;
    }

    try {
      // 料金計算
      const guestCount = parseInt(people);
      const totalPrice = await getTotalPrice(guestCount, temperature, date, selectedOptions);

      // エラーの詳細をログに出力
      console.log('Attempting to insert reservation with:', {
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: guestCount,
        email: email || null,
        phone: phone,
        water_temperature: 15, // 常に15°Cに固定
        status: 'confirmed', // 管理者からの予約は直接confirmedになる
        total_price: totalPrice,
        selectedOptions
      });

      const { data: newReservation, error } = await supabase.from("reservations").insert({
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: guestCount,
        email: email || null,
        phone: phone,
        water_temperature: 15, // 常に15°Cに固定
        status: 'confirmed', // 管理者からの予約は直接confirmedになる
        total_price: totalPrice
      }).select().single();

      if (error) {
        console.error("Reservation error:", error);
        throw error;
      }

      // オプションが選択されている場合は予約オプションを保存
      if (selectedOptions && selectedOptions.length > 0) {
        console.log("Saving admin reservation options:", selectedOptions, "for reservation ID:", newReservation.id);
        
        try {
          const reservationOptionsData = selectedOptions.map(option => ({
            reservation_id: newReservation.id,
            option_id: option.option_id,
            quantity: option.quantity
          }));

          const { error: optionsError } = await supabase
            .from("reservation_options")
            .insert(reservationOptionsData);

          if (optionsError) {
            console.error("Error inserting reservation options:", optionsError);
            // オプション保存エラーの場合でも予約自体は確定させるため、ここではthrowしない
            toast.error("オプション情報の保存に失敗しました");
          } else {
            console.log("Successfully saved reservation options");
          }
        } catch (optionError) {
          console.error("オプション保存中にエラーが発生しました:", optionError);
          toast.error("オプション情報の保存に失敗しました");
        }
      }

      toast.success("予約を登録しました");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("予約の登録に失敗しました:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
    }
  };

  const resetForm = () => {
    setDate(undefined);
    setTimeSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setPeople("");
    setTemperature("15"); // リセット時も15°Cに固定
    setSelectedOptions([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規予約登録</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <label className="block text-sm mb-2">日付を選択 *</label>
            <ReservationCalendar
              date={date}
              setDate={setDate}
              reservations={reservations}
            />
          </div>

          <ReservationDetails
            timeSlot={timeSlot}
            setTimeSlot={setTimeSlot}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            people={people}
            setPeople={setPeople}
            temperature={temperature}
            setTemperature={setTemperature}
            date={date}
            setDate={setDate}
            timeSlotReservations={timeSlotReservations}
          />

          {people && parseInt(people) > 0 && (
            <div className="border-t border-sauna-stone/10 pt-4">
              <ReservationOptions 
                selectedOptions={selectedOptions}
                setSelectedOptions={setSelectedOptions}
                guestCount={parseInt(people)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit}>
              予約を登録
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
