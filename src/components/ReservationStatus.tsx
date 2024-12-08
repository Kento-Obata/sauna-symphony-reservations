import { Circle, CircleCheck, CircleX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ReservationStatusProps = {
  guestCount: number;
};

export const ReservationStatus = ({ guestCount }: ReservationStatusProps) => {
  // 6人が最大予約人数
  const MAX_GUESTS = 6;
  
  const getStatusIcon = () => {
    if (guestCount === 0) {
      return {
        icon: <Circle className="h-4 w-4 text-green-500 fill-none" />,
        label: `予約可能（残り${MAX_GUESTS}名）`,
      };
    } else if (guestCount >= MAX_GUESTS) {
      return {
        icon: <CircleX className="h-4 w-4 text-red-500" />,
        label: "予約満席",
      };
    } else {
      return {
        icon: <CircleCheck className="h-4 w-4 text-yellow-500" />,
        label: `一部予約あり（残り${MAX_GUESTS - guestCount}名）`,
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