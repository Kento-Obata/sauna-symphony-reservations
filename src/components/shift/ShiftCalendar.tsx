import React, { useState, useMemo, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShiftEditorDialog } from "./ShiftEditorDialog";
import { useQuery } from "@tanstack/react-query";

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  staff_id: string;
  profiles: { username: string };
}

export const ShiftCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showShiftEditor, setShowShiftEditor] = useState(false);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const fetchShifts = async () => {
    const { data: shifts, error } = await supabase
      .from("shifts")
      .select(`
        *,
        profiles (
          username
        )
      `)
      .gte("start_time", start.toISOString())
      .lte("end_time", end.toISOString());

    if (error) throw error;
    return shifts;
  };

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["shifts", start.toISOString(), end.toISOString()],
    queryFn: fetchShifts,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes (renamed from cacheTime)
  });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const handleShiftClick = useCallback((e: React.MouseEvent, shift: Shift) => {
    e.stopPropagation();
    setSelectedShift(shift);
    setShowShiftEditor(true);
  }, []);

  const calculatePosition = (startTime: Date, endTime: Date, timeSlot: string, day: Date) => {
    const slotStart = new Date(day);
    const slotEnd = new Date(day);
    const [hours, minutes] = timeSlot.split(":").map(Number);
    slotStart.setHours(hours, minutes, 0, 0);
    slotEnd.setHours(hours, minutes + 30, 0, 0);

    if (isWithinInterval(startTime, { start: slotStart, end: slotEnd }) || 
        isWithinInterval(endTime, { start: slotStart, end: slotEnd })) {
      const top = (startTime.getHours() * 60 + startTime.getMinutes()) - (day.getHours() * 60 + day.getMinutes());
      const height = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      return {
        top: `${top}px`,
        height: `${height}px`,
      };
    }
    return null;
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
      slots.push(
        `${i.toString().padStart(2, "0")}:00`,
        `${i.toString().padStart(2, "0")}:30`
      );
    }
    return slots;
  }, []);

  return (
    <div className="bg-sauna-base dark:bg-sauna-charcoal rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
          {format(end, "MM月dd日", { locale: ja })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-2">
          <div className="col-span-1"></div>
          {days.map((day) => (
            <div
              key={day.toString()}
              className="col-span-1 text-center font-medium p-2"
            >
              {format(day, "M/d")}
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {format(day, "E", { locale: ja })}
              </div>
            </div>
          ))}

          {timeSlots.map((timeSlot) => (
            <React.Fragment key={timeSlot}>
              <div className="col-span-1 p-2 text-sm text-right text-gray-600 dark:text-gray-300">
                {timeSlot}
              </div>
              {days.map((day) => {
                const dayShifts = shifts.filter((shift) => {
                  const startTime = parseISO(shift.start_time);
                  return isSameDay(startTime, day);
                });

                return (
                  <div
                    key={`${day}-${timeSlot}`}
                    className="col-span-1 border rounded relative h-8 hover:bg-sauna-button transition-colors"
                  >
                    {dayShifts.map((shift) => {
                      const startTime = parseISO(shift.start_time);
                      const endTime = parseISO(shift.end_time);
                      const style = calculatePosition(
                        startTime,
                        endTime,
                        timeSlot,
                        day
                      );

                      if (!style) return null;

                      return (
                        <div
                          key={shift.id}
                          className="absolute bg-sauna-button dark:bg-sauna-charcoal rounded px-1 cursor-pointer hover:bg-opacity-90 transition-colors"
                          style={style}
                          onClick={(e) => handleShiftClick(e, shift)}
                        >
                          <div className="text-[10px] flex items-center justify-center h-full">
                            <span className="writing-vertical-lr">
                              {shift.profiles?.username}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}

      <ShiftEditorDialog
        isOpen={showShiftEditor}
        onOpenChange={setShowShiftEditor}
        date={selectedShift ? parseISO(selectedShift.start_time) : new Date()}
        staffId={selectedShift?.staff_id}
        startTime={selectedShift ? format(parseISO(selectedShift.start_time), "HH:mm") : undefined}
        endTime={selectedShift ? format(parseISO(selectedShift.end_time), "HH:mm") : undefined}
        mode={selectedShift ? "edit" : "create"}
        shiftId={selectedShift?.id}
      />
    </div>
  );
};