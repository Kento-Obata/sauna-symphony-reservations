import { XCircle, Circle } from "lucide-react";

type ReservationStatusProps = {
  reservationCount: number;
};

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const MAX_RESERVATIONS = 3;
  const remainingSlots = MAX_RESERVATIONS - reservationCount;

  if (remainingSlots === 0) {
    return (
      <div className="flex items-center justify-center">
        <XCircle className="h-4 w-4 text-red-500" />
      </div>
    );
  }

  if (remainingSlots === MAX_RESERVATIONS) {
    return (
      <div className="flex items-center justify-center">
        <Circle className="h-4 w-4 text-green-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <span className="text-green-500 text-sm font-medium">
        {remainingSlots}
      </span>
    </div>
  );
};