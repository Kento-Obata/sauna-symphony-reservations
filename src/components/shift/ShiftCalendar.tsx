import React, { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  setHours,
  setMinutes,
  addMinutes,
  isWithinInterval,
  differenceInMinutes,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShiftEditorDialog } from "./ShiftEditorDialog";
import { ShiftCalendarHeader } from "./ShiftCalendarHeader";
import { TimeAxis } from "./TimeAxis";
import { ShiftGrid } from "./ShiftGrid";
import { useToast } from "@/hooks/use-toast";

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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const { data: shifts } = useQuery({
    queryKey: ["shifts", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, profiles(username, id)")
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())
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

    const isFirstSlot = Math.abs(differenceInMinutes(startTime, slotTime)) < 30;
    if (!isFirstSlot) {
      return { visibility: 'hidden' as const };
    }

    const durationInSlots = Math.ceil(differenceInMinutes(endTime, startTime) / 30);
    return {
      height: `${durationInSlots * 1.75}rem`,
      zIndex: 10,
    };
  };

  const getShiftsForTimeSlot = (timeSlot: Date) => {
    if (!shifts) return [];
    return shifts.filter((shift) => {
      const startTime = new Date(shift.start_time);
      const endTime = new Date(shift.end_time);
      return isWithinInterval(timeSlot, { start: startTime, end: endTime });
    });
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedShift(null);
    setIsEditorOpen(true);
  };

  const handleShiftClick = (e: React.MouseEvent, shift: any) => {
    e.stopPropagation();
    setSelectedDate(new Date(shift.start_time));
    setSelectedShift({
      id: shift.id,
      staffId: shift.staff_id,
      startTime: new Date(shift.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }),
      endTime: new Date(shift.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
    setIsEditorOpen(true);
  };

  const handleShiftDelete = async (shiftId: string) => {
    const { error } = await supabase
      .from("shifts")
      .update({ status: "cancelled" })
      .eq("id", shiftId);

    if (error) {
      toast({
        title: "エラー",
        description: "シフトの削除に失敗しました",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "成功",
      description: "シフトを削除しました",
    });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <ShiftCalendarHeader
        start={start}
        end={end}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onAddShift={() => {
          setSelectedDate(new Date());
          setSelectedShift(null);
          setIsEditorOpen(true);
        }}
      />

      <div className="grid grid-cols-8 divide-x">
        <TimeAxis hours={HOURS} minutes={MINUTES} />
        <ShiftGrid
          days={days}
          hours={HOURS}
          minutes={MINUTES}
          getTimeSlots={getTimeSlots}
          getShiftsForTimeSlot={getShiftsForTimeSlot}
          calculateShiftStyle={calculateShiftStyle}
          getStaffColor={getStaffColor}
          onCellClick={handleCellClick}
          onShiftClick={handleShiftClick}
          onShiftDelete={handleShiftDelete}
        />
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