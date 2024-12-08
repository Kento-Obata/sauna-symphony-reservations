import { Circle, CircleCheck, CircleX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ReservationStatusProps = {
  guestCount: number;
};

export const ReservationStatus = ({ guestCount }: ReservationStatusProps) => {
  // 6人が最大予約人数
  const getStatusIcon = () => {
    if (guestCount === 0) {
      return {
        icon: <Circle className="text-green-500" />,
        label: "予約可能",
      };
    } else if (guestCount >= 6) {
      return {
        icon: <CircleX className="text-red-500" />,
        label: "予約満席",
      };
    } else {
      return {
        icon: <CircleCheck className="text-yellow-500" />,
        label: "一部予約あり",
      };
    }
  };

  const { icon, label } = getStatusIcon();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex items-center">{icon}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};