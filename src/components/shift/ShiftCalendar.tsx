import React, { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  format,
  addWeeks,
  subWeeks,
  setHours,
  setMinutes,
  addMinutes,
  isSameDay,
  parseISO,
  isWithinInterval,
  differenceInMinutes,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShiftEditorDialog } from "./ShiftEditorDialog";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);
const MINUTES = [0, 30];

const STAFF_COLORS = [
  'bg-purple-100 dark:bg-purple-900',
  'bg-blue-100 dark:bg-blue-900',
  'bg-green-100 dark:bg-green-900',
  'bg-yellow-100 dark:bg-yellow-900',
  'bg-pink-100 dark:bg-pink-900',
  'bg-indigo-100 dark:bg-indigo-900',
  'bg-orange-100 dark:bg-orange-900',
  'bg-teal-100 dark:bg-teal-900',
];

export const ShiftCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<{
    id: string;
    staffId: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const { data: shifts } = useQuery({
    queryKey: ["shifts", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, profiles(username, id)")
        .gte("start_time", format(start, "yyyy-MM-dd"))
        .lte("end_time", format(end, "yyyy-MM-dd"))
        .neq("status", "cancelled");

      if (error) throw error;
      return data;
    },
  });

  const getStaffColor = (staffId: string | undefined) => {
    if (!staffId) return STAFF_COLORS[0];
    const colorIndex = parseInt(staffId.substring(0, 8), 16) % STAFF_COLORS.length;
    return STAFF_COLORS[colorIndex];
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const getTimeSlots = (day: Date) => {
    const slots = [];
    for (const hour of HOURS) {
      for (const minute of MINUTES) {
        const time = setMinutes(setHours(day, hour), minute);
        slots.push(time);
      }
    }
    return slots;
  };

  const calculateShiftStyle = (startTime: Date, endTime: Date, slotTime: Date) => {
    const slotStart = new Date(slotTime);
    const slotEnd = addMinutes(slotTime, 30);
    
    if (!isWithinInterval(slotTime, { start: startTime, end: endTime })) {
      return null;
    }

    if (Math.abs(differenceInMinutes(startTime, slotTime)) <= 30) {
      const durationInSlots = Math.ceil(differenceInMinutes(endTime, startTime) / 30);
      return {
        height: `${durationInSlots * 1.75}rem`,
        zIndex: 10,
      };
    }

    return null;
  };

  const getShiftsForTimeSlot = (timeSlot: Date) => {
    if (!shifts) return [];
    return shifts.filter((shift) => {
      const startTime = parseISO(shift.start_time);
      const endTime = parseISO(shift.end_time);
      return isWithinInterval(timeSlot, { start: startTime, end: endTime });
    });
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedShift(null);
    setIsEditorOpen(true);
  };

  const handleShiftClick = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation(); // セルのクリックイベントが発火するのを防ぐ
    setSelectedDate(parseISO(shift.start_time));
    setSelectedShift({
      id: shift.id,
      staffId: shift.staff_id,
      startTime: format(parseISO(shift.start_time), "HH:mm"),
      endTime: format(parseISO(shift.end_time), "HH:mm"),
    });
    setIsEditorOpen(true);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <Button variant="outline" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
            {format(end, "MM月dd日", { locale: ja })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setSelectedDate(new Date());
              setSelectedShift(null);
              setIsEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            シフト追加
          </Button>
        </div>
        <Button variant="outline" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-8 divide-x">
        <div className="col-span-1 bg-gray-50 dark:bg-gray-900">
          <div className="h-16 border-b flex items-center justify-center font-medium text-xs">
            時間
          </div>
        </div>
        {days.map((day) => (
          <div key={day.toString()} className="col-span-1">
            <div className="h-16 border-b p-2 text-center">
              <div className="font-medium text-sm">{format(day, "M/d")}</div>
              <div className="text-xs text-gray-500">
                {format(day, "E", { locale: ja })}
              </div>
            </div>
          </div>
        ))}

        {HOURS.map((hour) =>
          MINUTES.map((minute, minuteIndex) => (
            <React.Fragment key={`${hour}-${minute}`}>
              <div className="col-span-1 h-7 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-end pr-2 text-xs">
                {format(
                  setMinutes(setHours(new Date(), hour), minute),
                  "HH:mm"
                )}
              </div>
              {days.map((day) => {
                const time = setMinutes(setHours(day, hour), minute);
                const shiftsInSlot = getShiftsForTimeSlot(time);
                return (
                  <div
                    key={`${day}-${hour}-${minute}`}
                    className="col-span-1 h-7 border-b hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer relative"
                    onClick={() => handleCellClick(time)}
                  >
                    {shiftsInSlot.map((shift) => {
                      const startTime = parseISO(shift.start_time);
                      const endTime = parseISO(shift.end_time);
                      const style = calculateShiftStyle(startTime, endTime, time);
                      
                      if (!style) return null;

                      return (
                        <div
                          key={shift.id}
                          className={`absolute inset-x-0 px-1 py-0.5 ${getStaffColor((shift.profiles as any)?.id)} rounded-sm cursor-pointer hover:brightness-95`}
                          style={style}
                          onClick={(e) => handleShiftClick(e, shift)}
                        >
                          <div className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">
                            {(shift.profiles as any)?.username}
                            <span className="ml-1">
                              {format(startTime, "HH:mm")}-{format(endTime, "HH:mm")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))
        )}
      </div>

      <ShiftEditorDialog
        date={selectedDate}
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        mode={selectedShift ? "edit" : "create"}
        staffId={selectedShift?.staffId}
        startTime={selectedShift?.startTime}
        endTime={selectedShift?.endTime}
        shiftId={selectedShift?.id}
      />
    </div>
  );
};