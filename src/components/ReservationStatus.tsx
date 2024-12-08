import { Circle, CircleCheck, CircleX } from "lucide-react";

type ReservationStatusProps = {
  reservationCount: number;
};

export const ReservationStatus = ({ reservationCount }: ReservationStatusProps) => {
  const getStatusIcon = () => {
    switch (reservationCount) {
      case 0:
        return {
          icon: <Circle className="h-4 w-4 text-green-500 fill-none" />,
          label: "予約なし",
        };
      case 1:
        return {
          icon: <CircleCheck className="h-4 w-4 text-yellow-500" />,
          label: "予約あり",
        };
      default:
        return {
          icon: <CircleX className="h-4 w-4 text-red-500" />,
          label: "予約済み",
        };
    }
  };

  const { icon, label } = getStatusIcon();

  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
  );
};