import { format, setHours, setMinutes } from "date-fns";

interface TimeAxisProps {
  hours: number[];
  minutes: number[];
}

export const TimeAxis = ({ hours, minutes }: TimeAxisProps) => {
  return (
    <>
      <div className="col-span-1 bg-gray-50 dark:bg-gray-900">
        <div className="h-16 border-b flex items-center justify-center font-medium text-xs">
          時間
        </div>
      </div>
      {hours.map((hour) =>
        minutes.map((minute) => (
          <div
            key={`${hour}-${minute}`}
            className="col-span-1 h-7 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-end pr-2 text-xs"
          >
            {format(setMinutes(setHours(new Date(), hour), minute), "HH:mm")}
          </div>
        ))
      )}
    </>
  );
};