interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  if (reservationCount === 0) {
    return <span className="text-black">○</span>;
  }

  if (reservationCount >= 3) {
    return <span className="text-black">×</span>;
  }

  return <span className="text-black">{reservationCount}</span>;
};