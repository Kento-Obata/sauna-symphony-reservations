import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isBefore } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { useReservations } from "@/hooks/useReservations";
import { TimeSlotSelect } from "./TimeSlotSelect";

const ReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: reservations, isLoading, error } = useReservations();

  const getTimeSlotReservations = (selectedDate: Date) => {
    const defaultSlotReservations: Record<TimeSlot, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0
    };

    if (!reservations) return defaultSlotReservations;

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    const slotReservations = reservations
      .filter(r => r.date === dateString)
      .reduce((acc, r) => {
        acc[r.time_slot] = (acc[r.time_slot] || 0) + 1;
        return acc;
      }, { ...defaultSlotReservations });

    return slotReservations;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !timeSlot || !name || !phone || !people || !temperature) {
      toast.error("必須項目をすべて入力してください。");
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmReservation = async (paymentMethod: "cash" | "online") => {
    try {
      const reservationData: ReservationFormData = {
        date: format(date!, "yyyy-MM-dd"),
        time_slot: timeSlot as TimeSlot,
        guest_name: name,
        guest_count: parseInt(people),
        email: email || null,
        phone: phone,
        water_temperature: parseInt(temperature),
      };

      if (paymentMethod === "online") {
        window.location.href = "https://your-payment-link.com";
        return;
      }

      const { error } = await supabase
        .from("reservations")
        .insert(reservationData);

      if (error) throw error;

      // Send notifications
      const notificationResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reservation-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            date: reservationData.date,
            timeSlot: reservationData.time_slot,
            guestName: reservationData.guest_name,
            guestCount: reservationData.guest_count,
            email: reservationData.email,
            phone: reservationData.phone,
            waterTemperature: reservationData.water_temperature,
          }),
        }
      );

      if (!notificationResponse.ok) {
        console.error("Failed to send notifications");
        toast.error("予約は完了しましたが、通知の送信に失敗しました。");
      }

      toast.success("予約を受け付けました");
      
      setDate(undefined);
      setTimeSlot("");
      setName("");
      setEmail("");
      setPhone("");
      setPeople("");
      setTemperature("");
      setShowConfirmDialog(false);
      
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error) {
      console.error("Error inserting reservation:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
    }
  };

  const getDayContent = (day: Date) => {
    if (!reservations || isBefore(day, new Date())) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString
    );

    const reservationCount = dateReservations.length;
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-1 gap-1">
        <span>{day.getDate()}</span>
        <div className="text-xs">
          <ReservationStatus reservationCount={reservationCount} />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div>予約情報を読み込んでいます...</div>;
  }

  if (error) {
    return <div>予約情報の読み込みに失敗しました。</div>;
  }

  const timeSlotReservations = date ? getTimeSlotReservations(date) : {
    morning: 0,
    afternoon: 0,
    evening: 0
  };

  const currentReservation: ReservationFormData | null = date && timeSlot ? {
    date: format(date, "yyyy-MM-dd"),
    time_slot: timeSlot as TimeSlot,
    guest_name: name,
    guest_count: parseInt(people) || 0,
    email: email || null,
    phone: phone,
    water_temperature: parseInt(temperature) || 0,
  } : null;

  return (
    <div className="glass-card p-8 animate-fade-in">
      <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
        Reservation
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => isBefore(date, new Date())}
              className="rounded-md border"
              components={{
                DayContent: ({ date }) => getDayContent(date)
              }}
            />
          </div>
          
          <div className="space-y-4">
            <TimeSlotSelect
              value={timeSlot}
              onValueChange={setTimeSlot}
              selectedDate={date}
              timeSlotReservations={timeSlotReservations}
            />

            <div>
              <label className="block text-sm mb-2">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Phone *</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Number of guests *</label>
              <Select onValueChange={setPeople} value={people}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-2">Water temperature *</label>
              <Select onValueChange={setTemperature} value={temperature}>
                <SelectTrigger>
                  <SelectValue placeholder="Select temperature" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => i + 2).map((temp) => (
                    <SelectItem key={temp} value={temp.toString()}>
                      {temp}°C
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="mb-4 text-sauna-stone">Price: ¥40,000 (tax included)</p>
          <Button type="submit" className="w-full md:w-auto hover-lift">
            Book
          </Button>
        </div>
      </form>

      {currentReservation && (
        <ReservationConfirmDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmReservation}
          reservation={currentReservation}
          onEdit={() => setShowConfirmDialog(false)}
        />
      )}
    </div>
  );
};

export default ReservationForm;