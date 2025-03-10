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
  const [temperature, setTemperature] = useState("");
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
      temperature,
    });

    if (!date || !timeSlot || !name || !phone || !people || !temperature) {
      console.log('Missing fields:', {
        date: !date,
        timeSlot: !timeSlot,
        name: !name,
        phone: !phone,
        people: !people,
        temperature: !temperature
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
      // エラーの詳細をログに出力
      console.log('Attempting to insert reservation with:', {
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
        status: 'confirmed' // 管理者からの予約は直接confirmedになる
      });

      const { error } = await supabase.from("reservations").insert({
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
        status: 'confirmed' // 管理者からの予約は直接confirmedになる
      });

      if (error) {
        console.error("Reservation error:", error);
        throw error;
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
    setTemperature("");
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
