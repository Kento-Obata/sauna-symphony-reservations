
import { Button } from "@/components/ui/button";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { format, isValid } from "date-fns";
import { ReservationConfirmDialog } from "./ReservationConfirmDialog";
import { useReservations } from "@/hooks/useReservations";
import { ReservationCalendar } from "./reservation/ReservationCalendar";
import { ReservationDetails } from "./reservation/ReservationDetails";
import { useReservationForm } from "@/hooks/useReservationForm";
import { useState, useEffect } from "react";
import { Checkbox } from "./ui/checkbox";
import { TermsDialog } from "./TermsDialog";
import { toast } from "sonner";
import { getTotalPrice, formatPrice } from "@/utils/priceCalculations";
import { CreditCard, Wallet } from "lucide-react";
import { ReservationOptions } from "./reservation/ReservationOptions";

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
    selectedOptions,
    setSelectedOptions,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
    reservationCode
  } = useReservationForm();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);

  const {
    data: reservations,
    isLoading,
    error
  } = useReservations();

  useEffect(() => {
    const updatePrice = async () => {
      if (people && temperature) {
        try {
          const price = await getTotalPrice(
            parseInt(people), 
            temperature,
            date,
            selectedOptions
          );
          setTotalPrice(price);
        } catch (error) {
          console.error("料金の計算に失敗しました:", error);
          toast.error("料金の計算に失敗しました");
        }
      } else {
        setTotalPrice(null);
      }
    };
    updatePrice();
  }, [people, temperature, date, selectedOptions]);

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
    options: selectedOptions
  } : null;

  return (
    <div className="glass-card p-4 sm:p-8 animate-fade-in w-full max-w-4xl mx-auto">
      <div className="text-3xl font-mplus font-thin mb-8 text-center text-gradient">
        Reservation
      </div>
      
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="w-full flex justify-center md:justify-start">
            <ReservationCalendar date={date} setDate={handleDateChange} reservations={reservations} />
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
        
        {/* オプション選択コンポーネント */}
        {people && parseInt(people) > 0 && (
          <div className="border-t border-sauna-stone/10 pt-6">
            <ReservationOptions 
              selectedOptions={selectedOptions}
              setSelectedOptions={setSelectedOptions}
              guestCount={parseInt(people)}
            />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox id="terms" checked={termsAccepted} onCheckedChange={() => setShowTermsDialog(true)} />
          <label htmlFor="terms" className="text-sm cursor-pointer hover:underline" onClick={() => setShowTermsDialog(true)}>
            利用規約に同意する
          </label>
        </div>

        <div className="text-center mt-8">
          <div className="mb-4">
            <p className="text-lg font-semibold text-sauna-stone">料金</p>
            <p className="text-2xl font-bold text-stone-600">
              {totalPrice !== null ? formatPrice(totalPrice) : "---"}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-sm text-muted-foreground flex items-center">
                <span className="mr-1">お支払い方法：</span>
                <CreditCard className="h-4 w-4 mr-1" /> カードまたは 
                <Wallet className="h-4 w-4 mx-1" /> 現金
              </p>
            </div>
          </div>
          <Button type="submit" className="w-full md:w-auto hover-lift bg-sauna-button hover:bg-sauna-button/90">
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
