interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const MAX_RESERVATIONS = 3;
  const availableSlots = MAX_RESERVATIONS - reservationCount;

  if (reservationCount === 0) {
    return <span className="text-black">○</span>;
  }

  if (availableSlots <= 0) {
    return <span className="text-black">×</span>;
  }

  return <span className="text-black">{availableSlots}</span>;
};