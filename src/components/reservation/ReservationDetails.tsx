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
  timeSlotReservations,
}: ReservationDetailsProps) => {
  return (
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
  );
};