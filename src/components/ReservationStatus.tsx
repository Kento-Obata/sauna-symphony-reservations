interface ReservationStatusProps {
  reservationCount: number;
  isClosed?: boolean;
}

export const ReservationStatus = ({ reservationCount, isClosed }: ReservationStatusProps) => {
  const MAX_RESERVATIONS = 3;

  if (isClosed) {
    return <span className="text-black">×</span>;
  }

  if (reservationCount === 0) {
    return <span className="text-black">○</span>;
  }

  if (reservationCount >= MAX_RESERVATIONS) {
    return <span className="text-black">×</span>;
  }

  return <span className="text-black">{MAX_RESERVATIONS - reservationCount}</span>;
};