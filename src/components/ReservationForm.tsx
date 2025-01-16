import { Button } from "@/components/ui/button";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format, isValid } from "date-fns";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { useReservations } from "@/hooks/useReservations";
import { ReservationCalendar } from "./reservation/ReservationCalendar";
import { ReservationDetails } from "./reservation/ReservationDetails";
import { useReservationForm } from "@/hooks/useReservationForm";
import { useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { TermsDialog } from "./TermsDialog";
import { toast } from "sonner";

const ReservationForm = () => {
  const {
    date,
    setDate,
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
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
    reservationCode,
  } = useReservationForm();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

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

    if (!reservations || !selectedDate || !isValid(selectedDate)) {
      console.log("Invalid date or no reservations:", { selectedDate, reservations });
      return defaultSlotReservations;
    }

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    const slotReservations = reservations
      .filter(r => r.date === dateString && (r.status === "confirmed" || r.status === "pending"))
      .reduce((acc, r) => {
        acc[r.time_slot] = (acc[r.time_slot] || 0) + 1;
        return acc;
      }, { ...defaultSlotReservations });

    return slotReservations;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      toast.error("利用規約に同意してください。");
      return;
    }

    handleSubmit(e);
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
      <div className="text-3xl font-mplus font-thin mb-8 text-center text-gradient">
        Reservation
      </div>
      
      <form onSubmit={handleFormSubmit} className="space-y-6">
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

        <div className="flex items-center space-x-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={() => setShowTermsDialog(true)}
          />
          <label
            htmlFor="terms"
            className="text-sm cursor-pointer hover:underline"
            onClick={() => setShowTermsDialog(true)}
          >
            利用規約に同意する
          </label>
        </div>

        <div className="text-center mt-8">
          <p className="mb-4 text-sauna-stone">料金: ¥40,000 (税込)</p>
          <Button type="submit" className="w-full md:w-auto hover-lift bg-sauna-base hover:bg-sauna-base/90">
            予約する
          </Button>
        </div>
      </form>

      <TermsDialog
        open={showTermsDialog}
        onOpenChange={setShowTermsDialog}
        checked={termsAccepted}
        onCheckedChange={setTermsAccepted}
      />

      {currentReservation && (
        <ReservationConfirmDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmReservation}
          reservation={currentReservation}
          onEdit={() => setShowConfirmDialog(false)}
          isSubmitting={isSubmitting}
          reservationCode={reservationCode}
        />
      )}
    </div>
  );
};

export default ReservationForm;
