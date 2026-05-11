interface ReservationStatusProps {
  reservationCount: number;
  isClosed?: boolean;
  maxReservations?: number;
}

export const ReservationStatus = ({ reservationCount, isClosed, maxReservations = 3 }: ReservationStatusProps) => {
  if (isClosed) {
    return <span className="text-black">×</span>;
  }

  if (reservationCount === 0) {
    return <span className="text-black">○</span>;
  }

  if (reservationCount >= maxReservations) {
    return <span className="text-black">×</span>;
  }

  return <span className="text-black">{maxReservations - reservationCount}</span>;
};
