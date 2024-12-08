import { CheckSquare, AlertOctagon, XSquare } from "lucide-react";

type ReservationStatusProps = {
  reservationCount: number;
};

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const getStatusIcon = () => {
    if (reservationCount === 0) {
      return <CheckSquare className="h-4 w-4 text-green-500" />;
    } else if (reservationCount < 3) {
      return <AlertOctagon className="h-4 w-4 text-yellow-500" />;
    } else {
      return <XSquare className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="flex items-center justify-center" title={
      reservationCount === 0 ? "予約可能" :
      reservationCount < 3 ? "残りわずか" :
      "予約不可"
    }>
      {getStatusIcon()}
    </div>
  );
};