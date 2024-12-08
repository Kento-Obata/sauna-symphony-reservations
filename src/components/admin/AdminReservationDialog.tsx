import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReservationDetails } from "@/components/reservation/ReservationDetails";
import { TimeSlot } from "@/types/reservation";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AdminReservationDialogProps {
  selectedDate: Date;
  timeSlotReservations: Record<TimeSlot, number>;
  initialTimeSlot?: TimeSlot;
  trigger?: React.ReactNode;
}

export const AdminReservationDialog = ({ 
  selectedDate, 
  timeSlotReservations,
  initialTimeSlot,
  trigger
}: AdminReservationDialogProps) => {
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">(initialTimeSlot || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!timeSlot || !name || !phone || !people || !temperature) {
      toast.error("必須項目をすべて入力してください。");
      return;
    }

    try {
      const reservationData = {
        date: format(selectedDate, "yyyy-MM-dd"),
        time_slot: timeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
      };

      const { error } = await supabase
        .from("reservations")
        .insert(reservationData);

      if (error) throw error;

      toast.success("予約を登録しました");
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      
      // Reset form
      setTimeSlot("");
      setName("");
      setEmail("");
      setPhone("");
      setPeople("");
      setTemperature("");
    } catch (error) {
      console.error("予約の登録に失敗しました:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">新規予約を追加</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新規予約登録</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
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
            date={selectedDate}
            timeSlotReservations={timeSlotReservations}
          />
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit">
              予約を登録
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};