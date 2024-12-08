import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { TimeSlot } from "@/types/reservation";
import { ReservationDetails } from "@/components/reservation/ReservationDetails";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">(defaultTimeSlot || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");

  useEffect(() => {
    if (open && defaultDate) {
      setDate(defaultDate);
    }
  }, [defaultDate, open]);

  const handleSubmit = async () => {
    if (!date || !timeSlot || !name || !phone || !people || !temperature) {
      toast.error("必須項目をすべて入力してください。");
      return;
    }

    try {
      const { error } = await supabase.from("reservations").insert({
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
      });

      if (error) throw error;

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
            timeSlotReservations={{
              morning: 0,
              afternoon: 0,
              evening: 0,
            }}
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