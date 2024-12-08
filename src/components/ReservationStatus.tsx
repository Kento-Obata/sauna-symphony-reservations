import { Circle, CircleCheck, CircleX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ReservationStatusProps = {
  guestCount: number;
};

export const ReservationStatus = ({ guestCount }: ReservationStatusProps) => {
  const getStatusIcon = () => {
    if (guestCount === 0) {
      return {
        icon: <Circle className="h-4 w-4 text-green-500 fill-none" />,
        label: "予約可能",
      };
    } else {
      return {
        icon: <CircleX className="h-4 w-4 text-red-500" />,
        label: "予約済み",
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