import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeSlot } from "@/types/reservation";
import { TimeSlotSelect } from "@/components/TimeSlotSelect";
import { format, addMonths, getDaysInMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

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
  timeSlotReservations,
}: ReservationDetailsProps) => {
  const isMobile = useIsMobile();
  const today = new Date();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(today, i));

  const handleMonthSelect = (monthStr: string) => {
    const selectedMonth = new Date(monthStr);
    setDate(selectedMonth);
  };

  const handleDateSelect = (day: number) => {
    if (!date) return;
    const newDate = new Date(date.getFullYear(), date.getMonth(), day);
    setDate(newDate);
  };

  const getDaysArray = (selectedDate: Date) => {
    const daysInMonth = getDaysInMonth(selectedDate);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  return (
    <div className="space-y-4">
      {isMobile && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">月を選択 *</label>
            <Select
              value={date ? format(date, "yyyy-MM") : undefined}
              onValueChange={handleMonthSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="月を選択" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem
                    key={format(month, "yyyy-MM")}
                    value={format(month, "yyyy-MM")}
                  >
                    {format(month, "yyyy年MM月", { locale: ja })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {date && (
            <div>
              <label className="block text-sm mb-2">日付を選択 *</label>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="grid grid-cols-4 gap-2">
                  {getDaysArray(date).map((day) => {
                    const dayDate = new Date(
                      date.getFullYear(),
                      date.getMonth(),
                      day
                    );
                    const isSelected =
                      date &&
                      day === date.getDate() &&
                      date.getMonth() === dayDate.getMonth();

                    return (
                      <Button
                        key={day}
                        variant={isSelected ? "default" : "outline"}
                        className="w-full"
                        onClick={() => handleDateSelect(day)}
                      >
                        {day}日
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      <TimeSlotSelect
        value={timeSlot}
        onValueChange={setTimeSlot}
        selectedDate={date}
        timeSlotReservations={timeSlotReservations}
      />

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
        <label className="block text-sm mb-2">水風呂温度 *</label>
        <Select onValueChange={setTemperature} value={temperature}>
          <SelectTrigger>
            <SelectValue placeholder="温度を選択" />
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
  );
};