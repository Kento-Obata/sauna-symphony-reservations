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
import { toast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ReservationStatus } from "@/components/ReservationStatus";

const ReservationForm = () => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [temperature, setTemperature] = useState("");

  const { data: reservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .order("date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeSlot || !name || !phone || !people || !temperature) {
      toast({
        title: "入力エラー",
        description: "必須項目をすべて入力してください。",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "予約を受け付けました",
      description: "確認メールをお送りいたします。",
    });
  };

  const getTimeSlotLabel = (slot: string) => {
    switch (slot) {
      case "morning":
        return "10:00-12:30";
      case "afternoon":
        return "13:30-16:00";
      case "evening":
        return "17:00-19:30";
      default:
        return "";
    }
  };

  const getDayContent = (day: Date) => {
    if (!reservations) return null;

    const dateReservations = reservations.filter(
      (r) => format(new Date(r.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );

    const totalGuests = dateReservations.reduce((sum, r) => sum + r.guest_count, 0);
    
    return totalGuests > 0 ? (
      <div className="absolute bottom-0 right-0">
        <ReservationStatus guestCount={totalGuests} />
      </div>
    ) : null;
  };

  return (
    <div className="glass-card p-8 animate-fade-in">
      <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
        ご予約
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              components={{
                DayContent: ({ date }) => (
                  <div className="relative w-full h-full">
                    <span>{date.getDate()}</span>
                    {getDayContent(date)}
                  </div>
                ),
              }}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">時間帯</label>
              <Select onValueChange={setTimeSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="時間帯を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">10:00-12:30</SelectItem>
                  <SelectItem value="afternoon">13:30-16:00</SelectItem>
                  <SelectItem value="evening">17:00-19:30</SelectItem>
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
              <Select onValueChange={setPeople}>
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
              <Select onValueChange={setTemperature}>
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