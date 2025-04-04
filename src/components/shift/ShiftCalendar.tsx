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
  areIntervalsOverlapping,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, PencilLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShiftEditorDialog } from "./ShiftEditorDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const { data: shifts } = useQuery({
    queryKey: ["shifts", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"), selectedStaffId],
    queryFn: async () => {
      let query = supabase
        .from("shifts")
        .select("*, profiles(username, id)")
        .gte("start_time", startOfDay(start).toISOString())
        .lte("end_time", endOfDay(addDays(end, 1)).toISOString())
        .neq("status", "cancelled");

      if (selectedStaffId && selectedStaffId !== "all") {
        query = query.eq("staff_id", selectedStaffId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("role", ["staff", "admin"]);

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

  const calculateShiftPosition = (shift: any, allShifts: any[]) => {
    const currentShiftStart = parseISO(shift.start_time);
    const currentShiftEnd = parseISO(shift.end_time);
    
    // Find overlapping shifts
    const overlappingShifts = allShifts.filter(otherShift => {
      if (otherShift.id === shift.id) return false;
      
      const otherStart = parseISO(otherShift.start_time);
      const otherEnd = parseISO(otherShift.end_time);
      
      return areIntervalsOverlapping(
        { start: currentShiftStart, end: currentShiftEnd },
        { start: otherStart, end: otherEnd }
      );
    });

    // Calculate position based on overlapping shifts
    const position = overlappingShifts.filter(
      otherShift => otherShift.id < shift.id
    ).length;

    const totalOverlapping = overlappingShifts.length + 1;
    const width = Math.min(33, 100 / totalOverlapping);
    
    return {
      left: `${position * width}%`,
      width: `${width}%`,
    };
  };

  const calculateShiftStyle = (startTime: Date, endTime: Date, slotTime: Date, shift: any, allShifts: any[]) => {
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
    const position = calculateShiftPosition(shift, allShifts);
    
    return {
      height: `${durationInSlots * 1.75}rem`,
      zIndex: 10,
      ...position,
    };
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
    e.stopPropagation();
    const startTime = parseISO(shift.start_time);
    const endTime = parseISO(shift.end_time);
    setSelectedDate(startTime);
    setSelectedShift({
      id: shift.id,
      staffId: shift.staff_id,
      startTime: format(startTime, "HH:mm"),
      endTime: format(endTime, "HH:mm"),
    });
    setIsEditorOpen(true);
  };

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ["calendar-events", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"))
        .eq("type", "note");

      if (error) throw error;
      return data;
    },
  });

  const handleEventSave = async () => {
    try {
      if (editingEventId) {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            title: eventTitle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingEventId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .insert({
            title: eventTitle,
            date: format(selectedDate, "yyyy-MM-dd"),
            type: "note",
          });

        if (error) throw error;
      }

      await refetchEvents();
      setIsEventDialogOpen(false);
      setEventTitle("");
      setEditingEventId(null);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const handleEditEvent = (event: any) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setSelectedDate(parseISO(event.date));
    setIsEventDialogOpen(true);
  };

  return (
    <div className="bg-sauna-base rounded-lg shadow overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b gap-4 bg-sauna-base">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base">
            {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
            {format(end, "MM月dd日", { locale: ja })}
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="スタッフで絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て表示</SelectItem>
              {staffMembers?.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full sm:w-auto"
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
      </div>

      <div className="grid grid-cols-8 divide-x bg-sauna-base">
        <div className="col-span-1 bg-sauna-base">
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
              <div className="mt-1">
                {events?.find((event) => event.date === format(day, "yyyy-MM-dd")) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full px-1 overflow-hidden"
                    onClick={() =>
                      handleEditEvent(
                        events.find((event) => event.date === format(day, "yyyy-MM-dd"))
                      )
                    }
                  >
                    <PencilLine className="h-3 w-3 shrink-0" />
                    <span className="ml-1 text-xs truncate block">
                      {
                        events.find((event) => event.date === format(day, "yyyy-MM-dd"))
                          ?.title
                      }
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full px-1"
                    onClick={() => {
                      setSelectedDate(day);
                      setEventTitle("");
                      setEditingEventId(null);
                      setIsEventDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span className="ml-1 text-xs">メモ</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {HOURS.map((hour) =>
          MINUTES.map((minute, minuteIndex) => (
            <React.Fragment key={`${hour}-${minute}`}>
              <div className="col-span-1 h-7 border-b bg-sauna-base flex items-center justify-end pr-2 text-xs">
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
                    className="col-span-1 h-7 border-b hover:bg-sauna-button transition-colors cursor-pointer relative"
                    onClick={() => handleCellClick(time)}
                  >
                    {shiftsInSlot.map((shift) => {
                      const startTime = parseISO(shift.start_time);
                      const endTime = parseISO(shift.end_time);
                      const style = calculateShiftStyle(startTime, endTime, time, shift, shiftsInSlot);
                      
                      if (!style) return null;

                      return (
                        <div
                          key={shift.id}
                          className={`absolute px-1 py-0.5 ${getStaffColor((shift.profiles as any)?.id)} rounded-sm cursor-pointer hover:brightness-95`}
                          style={style}
                          onClick={(e) => handleShiftClick(e, shift)}
                        >
                          <div className="text-[10px]">
                            <span className="writing-vertical-lr">{(shift.profiles as any)?.username}</span>
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

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {format(selectedDate, "M月d日")}のメモを{editingEventId ? "編集" : "追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="メモを入力"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEventDialogOpen(false);
                  setEventTitle("");
                  setEditingEventId(null);
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handleEventSave}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
