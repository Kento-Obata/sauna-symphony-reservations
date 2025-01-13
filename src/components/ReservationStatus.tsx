export const ReservationStatus = ({ reservationCount }: { reservationCount: number }) => {
  if (reservationCount === 0) {
    return <span className="text-green-500 font-bold text-lg">○</span>;
  }

  if (reservationCount < 3) {
    return <span className="text-yellow-500 font-bold text-lg">△</span>;
  }

  return <span className="text-red-500 font-bold text-lg">×</span>;
};