interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  if (reservationCount === 0) {
    return <span className="text-[#a29da9]">○</span>;
  }

  if (reservationCount >= 3) {
    return <span className="text-[#a29da9]">×</span>;
  }

  return <span className="text-[#a29da9]">{reservationCount}</span>;
};