import { useState } from "react";
import { format } from "date-fns";
import { ja } from 'date-fns/locale';
import { TimeSlot } from "@/types/reservation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSlotSelect } from "@/components/TimeSlotSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [isOpen, setIsOpen] = useState(false);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">(initialTimeSlot || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [waterTemperature, setWaterTemperature] = useState(40);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeSlot) return;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    try {
      const { error } = await supabase
        .from('reservations')
        .insert({
          date: formattedDate,
          time_slot: timeSlot,
          guest_name: name,
          guest_count: guestCount,
          email: email || null,
          phone,
          water_temperature: waterTemperature,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  const resetForm = () => {
    setTimeSlot(initialTimeSlot || "");
    setName("");
    setEmail("");
    setPhone("");
    setGuestCount(1);
    setWaterTemperature(40);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">新規予約を追加</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新規予約 - {format(selectedDate, 'yyyy年MM月dd日 (E)', { locale: ja })}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timeSlot">時間帯</Label>
            <TimeSlotSelect
              value={timeSlot}
              onChange={setTimeSlot}
              timeSlotReservations={timeSlotReservations}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">お名前</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">電話番号</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestCount">人数</Label>
            <Input
              id="guestCount"
              type="number"
              min={1}
              max={10}
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waterTemperature">水温</Label>
            <Input
              id="waterTemperature"
              type="number"
              min={35}
              max={45}
              value={waterTemperature}
              onChange={(e) => setWaterTemperature(parseInt(e.target.value))}
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit">
              予約を作成
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};