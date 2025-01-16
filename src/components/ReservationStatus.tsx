interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  if (reservationCount === 0) {
    return <span className="text-[#403e43]">○</span>;
  }

  if (reservationCount >= 3) {
    return <span className="text-[#403e43]">×</span>;
  }

  return <span className="text-[#403e43]">{reservationCount}</span>;
};