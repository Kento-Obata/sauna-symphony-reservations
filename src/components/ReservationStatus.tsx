interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  if (reservationCount === 0) {
    return <span className="text-[#7b7585]">○</span>;
  }

  if (reservationCount >= 3) {
    return <span className="text-[#7b7585]">×</span>;
  }

  return <span className="text-[#7b7585]">{reservationCount}</span>;
};