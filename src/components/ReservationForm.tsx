import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { useReservations } from "@/hooks/useReservations";
import { ReservationCalendar } from "./reservation/ReservationCalendar";
import { ReservationDetails } from "./reservation/ReservationDetails";

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

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate);
    setTimeSlot(""); // Reset time slot when date changes
  };

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

      // Check for existing reservations
      const { data: existingReservations } = await supabase
        .from("reservations")
        .select("*")
        .eq("date", reservationData.date)
        .eq("time_slot", reservationData.time_slot);

      if (existingReservations && existingReservations.length > 0) {
        toast.error("申し訳ありませんが、この時間帯はすでに予約が入っています。");
        return;
      }

      const { error } = await supabase
        .from("reservations")
        .insert(reservationData);

      if (error) throw error;

      const notificationResponse = await supabase.functions.invoke(
        "send-reservation-notification",
        {
          body: {
            date: reservationData.date,
            timeSlot: reservationData.time_slot,
            guestName: reservationData.guest_name,
            guestCount: reservationData.guest_count,
            email: reservationData.email,
            phone: reservationData.phone,
            waterTemperature: reservationData.water_temperature,
          },
        }
      );

      if (notificationResponse.error) {
        console.error("通知の送信に失敗しました:", notificationResponse.error);
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
      console.error("予約の登録に失敗しました:", error);
      toast.error("予約の登録に失敗しました。もう一度お試しください。");
    }
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
    <div className="glass-card p-4 sm:p-8 animate-fade-in w-full max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
        ご予約
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="w-full flex justify-center md:justify-start">
            <ReservationCalendar
              date={date}
              setDate={handleDateChange}
              reservations={reservations}
            />
          </div>
          
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
            setDate={handleDateChange}
            timeSlotReservations={timeSlotReservations}
          />
        </div>

        <div className="text-center mt-8">
          <p className="mb-4 text-sauna-stone">料金: ¥40,000 (税込)</p>
          <Button type="submit" className="w-full md:w-auto hover-lift">
            予約する
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