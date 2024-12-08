import { CheckSquare, AlertOctagon, XSquare } from "lucide-react";

type ReservationStatusProps = {
  reservationCount: number;
};

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const getStatusIcon = () => {
    switch (reservationCount) {
      case 0:
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case 1:
        return <AlertOctagon className="h-4 w-4 text-yellow-500" />;
      default:
        return <XSquare className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="flex items-center justify-center">
      {getStatusIcon()}
    </div>
  );
};