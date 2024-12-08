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
import { format } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { useReservations } from "@/hooks/useReservations";

const ReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");
  const queryClient = useQueryClient();

  const { data: reservations, isLoading, error } = useReservations();

  const getUnavailableTimeSlots = (selectedDate: Date) => {
    if (!reservations) return [];

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    // Create a Set of time slots that have any reservations
    const unavailableSlots = new Set(
      reservations
        .filter(r => r.date === dateString)
        .map(r => r.time_slot)
    );

    return Array.from(unavailableSlots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !timeSlot || !name || !phone || !people || !temperature) {
      toast.error("必須項目をすべて入力してください。");
      return;
    }

    try {
      const reservationData: ReservationFormData = {
        date: format(date, "yyyy-MM-dd"),
        time_slot: timeSlot as TimeSlot,
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

      toast.success("予約を受け付けました");
      
      setDate(undefined);
      setTimeSlot("");
      setName("");
      setEmail("");
      setPhone("");
      setPeople("");
      setTemperature("");
      
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    } catch (error) {
      console.error("Error inserting reservation:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
    }
  };

  const getDayContent = (day: Date) => {
    if (!reservations) return null;

    const dateString = format(day, 'yyyy-MM-dd');
    const dateReservations = reservations.filter(
      (r) => r.date === dateString
    );

    const totalGuests = dateReservations.reduce((sum, r) => sum + r.guest_count, 0);
    
    return (
      <div className="w-full h-full flex flex-col items-center justify-start pt-1 gap-1">
        <span>{day.getDate()}</span>
        <div className="text-xs">
          <ReservationStatus guestCount={totalGuests} />
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

  const unavailableTimeSlots = date ? getUnavailableTimeSlots(date) : [];

  return (
    <div className="glass-card p-8 animate-fade-in">
      <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
        ご予約
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              components={{
                DayContent: ({ date }) => getDayContent(date)
              }}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">時間帯</label>
              <Select 
                onValueChange={(value: TimeSlot) => setTimeSlot(value)} 
                value={timeSlot}
              >
                <SelectTrigger>
                  <SelectValue placeholder="時間帯を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem 
                    value="morning" 
                    disabled={unavailableTimeSlots.includes('morning')}
                  >
                    10:00-12:30
                  </SelectItem>
                  <SelectItem 
                    value="afternoon" 
                    disabled={unavailableTimeSlots.includes('afternoon')}
                  >
                    13:30-16:00
                  </SelectItem>
                  <SelectItem 
                    value="evening" 
                    disabled={unavailableTimeSlots.includes('evening')}
                  >
                    17:00-19:30
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-2">お名前 *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2">メールアドレス</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm mb-2">電話番号 *</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2">人数 *</label>
              <Select onValueChange={setPeople} value={people}>
                <SelectTrigger>
                  <SelectValue placeholder="人数を選択" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}名
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-2">水風呂の温度 *</label>
              <Select onValueChange={setTemperature} value={temperature}>
                <SelectTrigger>
                  <SelectValue placeholder="温度を選択" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => i + 2).map((temp) => (
                    <SelectItem key={temp} value={temp.toString()}>
                      {temp}℃
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </div>

        <div className="text-center mt-8">
          <p className="mb-4 text-sauna-stone">料金: 40,000円（税込）</p>
          <Button type="submit" className="w-full md:w-auto hover-lift">
            予約する
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReservationForm;
