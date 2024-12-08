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
import { format, isBefore, addHours, setHours, setMinutes } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { AlertOctagon } from "lucide-react";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { useReservations } from "@/hooks/useReservations";

const TIME_SLOTS = {
  morning: { start: '10:00', end: '12:30' },
  afternoon: { start: '13:30', end: '16:00' },
  evening: { start: '17:00', end: '19:30' }
} as const;

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
    if (!reservations) return {};

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    const slotReservations = reservations
      .filter(r => r.date === dateString)
      .reduce((acc, r) => {
        acc[r.time_slot] = (acc[r.time_slot] || 0) + 1;
        return acc;
      }, {} as Record<TimeSlot, number>);

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

  const isTimeSlotDisabled = (slot: TimeSlot, selectedDate: Date) => {
    const now = new Date();
    const twoHoursFromNow = addHours(now, 2);
    
    const [startHour, startMinute] = TIME_SLOTS[slot].start.split(':').map(Number);
    const slotTime = setMinutes(setHours(selectedDate, startHour), startMinute);
    
    return isBefore(slotTime, twoHoursFromNow);
  };

  const getDayContent = (day: Date) => {
    if (!reservations) return null;

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

  const timeSlotReservations = date ? getTimeSlotReservations(date) : {};

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
            <div>
              <label className="block text-sm mb-2">Time</label>
              <Select 
                onValueChange={(value: TimeSlot) => setTimeSlot(value)} 
                value={timeSlot}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'morning', label: '10:00-12:30' },
                    { value: 'afternoon', label: '13:30-16:00' },
                    { value: 'evening', label: '17:00-19:30' }
                  ].map(({ value, label }) => (
                    <SelectItem 
                      key={value} 
                      value={value}
                      disabled={
                        timeSlotReservations[value as TimeSlot] >= 1 ||
                        (date && isTimeSlotDisabled(value as TimeSlot, date))
                      }
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{label}</span>
                        {timeSlotReservations[value as TimeSlot] > 0 && (
                          <AlertOctagon className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
