import { Check, X, Minus } from "lucide-react";

interface ReservationStatusProps {
  reservationCount: number;
}

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  if (reservationCount === 0) {
    return (
      <div className="flex items-center justify-center text-green-500" title="予約可能">
        <Check className="h-4 w-4" />
      </div>
    );
  }

  if (reservationCount >= 1) {
    return (
      <div className="flex items-center justify-center text-red-500" title="予約不可">
        <X className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center text-yellow-500" title="確認中">
      <Minus className="h-4 w-4" />
    </div>
  );
};