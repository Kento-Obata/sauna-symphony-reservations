type ReservationStatusProps = {
  reservationCount: number;
};

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const MAX_RESERVATIONS = 3;
  const remainingSlots = MAX_RESERVATIONS - reservationCount;

  return (
    <div className="flex items-center justify-center">
      <span className="text-green-500 text-sm font-medium">
        {remainingSlots}
      </span>
    </div>
  );
};