
import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeSlot } from "@/types/reservation";
import { TimeSlotSelect } from "@/components/TimeSlotSelect";
import { useIsMobile } from "@/hooks/use-mobile";
import { MonthSelector } from "./MonthSelector";
import { DaySelector } from "./DaySelector";
import { isValid } from "date-fns";

interface ReservationDetailsProps {
  timeSlot: TimeSlot | "";
  setTimeSlot: (value: TimeSlot | "") => void;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  people: string;
  setPeople: (value: string) => void;
  temperature: string;
  setTemperature: (value: string) => void;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  timeSlotReservations: Record<TimeSlot, number>;
}

export const ReservationDetails = ({
  timeSlot,
  setTimeSlot,
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  people,
  setPeople,
  temperature,
  setTemperature,
  date,
  setDate,
  timeSlotReservations
}: ReservationDetailsProps) => {
  const isMobile = useIsMobile();

  const handleMonthSelect = (monthStr: string) => {
    try {
      const selectedMonth = new Date(monthStr);
      if (!isValid(selectedMonth)) {
        console.error("Invalid month selected:", monthStr);
        return;
      }
      setDate(selectedMonth);
      setTimeSlot(""); // Reset time slot when month changes
    } catch (error) {
      console.error("Error selecting month:", error);
    }
  };

  const handleDateSelect = (day: number) => {
    if (!date || !isValid(date)) {
      console.error("Invalid date for day selection:", date);
      return;
    }
    try {
      const newDate = new Date(date.getFullYear(), date.getMonth(), day);
      if (!isValid(newDate)) {
        console.error("Invalid date created:", newDate);
        return;
      }
      setDate(newDate);
      setTimeSlot(""); // Reset time slot when date changes
    } catch (error) {
      console.error("Error selecting date:", error);
    }
  };

  // 水温は常に15度に固定
  React.useEffect(() => {
    setTemperature("15");
  }, [timeSlot, date, setTemperature]);

  return (
    <div className="space-y-4">
      {isMobile && (
        <div className="space-y-4">
          <MonthSelector date={date} onMonthSelect={handleMonthSelect} />
          {date && <DaySelector date={date} onDaySelect={handleDateSelect} />}
        </div>
      )}

      <div>
        <label className="block text-sm mb-2">
          時間帯 <span className="text-red-500">*</span>
        </label>
        <TimeSlotSelect
          value={timeSlot}
          onValueChange={setTimeSlot}
          selectedDate={date}
          timeSlotReservations={timeSlotReservations}
        />
      </div>

      <div>
        <label className="block text-sm mb-2">
          お名前 <span className="text-red-500">*</span>
        </label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label className="block text-sm mb-2">
          電話番号 <span className="text-red-500">*</span>
        </label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-2">メールアドレス（任意）</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-2">
          人数 <span className="text-red-500">*</span>
        </label>
        <Select onValueChange={setPeople} value={people}>
          <SelectTrigger>
            <SelectValue placeholder="人数を選択" />
          </SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6].map((num) => (
              <SelectItem key={num} value={num.toString()}>
                {num}名
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-1">
          ※ 1名様でも2名様料金でご利用いただけます。
        </p>
      </div>

      {/* 水風呂温度フォームを非表示にする（値は内部的には15度で固定） */}
    </div>
  );
};
