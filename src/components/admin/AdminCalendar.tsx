
import React, { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Reservation, TimeSlot } from "@/types/reservation";
import { AdminReservationDialog } from "./AdminReservationDialog";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useShopClosures } from "@/hooks/useShopClosures";
import { AdminCalendarEventDialog } from "./AdminCalendarEventDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AdminCalendarProps {
  reservations?: Reservation[];
  onDateSelect?: (date: Date) => void;
}

export const AdminCalendar = ({ 
  reservations = [], 
  onDateSelect 
}: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { closures: shopClosures } = useShopClosures();

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const { data: events } = useQuery({
    queryKey: ["calendar-events", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      if (error) throw error;
      return data;
    },
  });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const getReservationsForDateAndSlot = (date: Date, timeSlot: string) => {
    return reservations.filter(
      (r) => 
        r.date === format(date, "yyyy-MM-dd") && 
        r.time_slot === timeSlot &&
        (r.status === "confirmed" || r.status === "pending")
    );
  };

  const getEventsForDate = (date: Date) => {
    return events?.filter((event) => event.date === format(date, "yyyy-MM-dd")) || [];
  };

  const isDateClosed = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return shopClosures?.some(closure => closure.date === dateString);
  };

  const handleBlockTimeSlot = async () => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      // まず現在のアクティブな予約を取得
      const { data: existingReservations, error: fetchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', dateStr)
        .eq('time_slot', selectedTimeSlot)
        .in('status', ['confirmed', 'pending']);

      if (fetchError) throw fetchError;

      // 既存の予約があれば、それらをキャンセル
      if (existingReservations && existingReservations.length > 0) {
        const { error: cancelError } = await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .in('id', existingReservations.map(r => r.id));

        if (cancelError) throw cancelError;
      }

      // 休枠を設定
      const { error: insertError } = await supabase
        .from("reservations")
        .insert({
          date: dateStr,
          time_slot: selectedTimeSlot,
          guest_name: "休枠",
          guest_count: 1,
          phone: "00000000000",
          water_temperature: 15,
          status: "confirmed"
        });

      if (insertError) throw insertError;

      toast.success("休枠を設定しました");
      setShowBlockDialog(false);
    } catch (error) {
      console.error("Error blocking time slot:", error);
      toast.error("休枠の設定に失敗しました");
    }
  };

  const handleCellClick = (date: Date, timeSlot: TimeSlot) => {
    if (isDateClosed(date)) return;
    
    const slotReservations = getReservationsForDateAndSlot(date, timeSlot);
    if (slotReservations.length === 1) {
      setSelectedReservation(slotReservations[0]);
      setShowDetailsDialog(true);
    } else {
      setSelectedDate(date);
      setSelectedTimeSlot(timeSlot);
      setShowReservationDialog(true);
    }
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  const handleEventClick = (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDate(null);
    setShowEventDialog(true);
  };

  const handleBlockClick = (e: React.MouseEvent, date: Date, timeSlot: TimeSlot) => {
    e.stopPropagation();
    setSelectedDate(date);
    setSelectedTimeSlot(timeSlot);
    setShowBlockDialog(true);
  };

  const getStatusDisplay = (date: Date, reservations: Reservation[]) => {
    if (isDateClosed(date)) {
      return <span className="text-black">休</span>;
    }

    if (reservations.length === 0) {
      return <span className="text-black">○</span>;
    }

    const totalGuests = reservations.reduce((sum, r) => sum + r.guest_count, 0);
    return <span className="text-black">{totalGuests}</span>;
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case "event":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "schedule":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "note":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="bg-sauna-base dark:bg-sauna-charcoal rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={handlePrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-black dark:text-white">
          {format(start, "yyyy年MM月dd日", { locale: ja })} -{" "}
          {format(end, "MM月dd日", { locale: ja })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div className="col-span-1"></div>
        {days.map((day) => (
          <button
            key={day.toString()}
            onClick={() => handleDayClick(day)}
            className="col-span-1 text-center font-medium p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            {format(day, "M/d")}
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {format(day, "E", { locale: ja })}
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {getEventsForDate(day).map((event) => (
                <Badge
                  key={event.id}
                  className={`text-xs cursor-pointer truncate ${getEventBadgeColor(event.type)}`}
                  onClick={(e) => handleEventClick(e, event)}
                >
                  {event.title}
                </Badge>
              ))}
            </div>
          </button>
        ))}

        {(Object.entries(TIME_SLOTS) as [TimeSlot, { start: string }][]).map(([slot, time]) => (
          <React.Fragment key={`time-${slot}`}>
            <div className="col-span-1 p-2 text-sm text-right text-gray-600 dark:text-gray-300">
              {time.start}
            </div>
            {days.map((day) => {
              const slotReservations = getReservationsForDateAndSlot(day, slot);
              const isBlocked = slotReservations.some(r => r.guest_name === "休枠");
              return (
                <div
                  key={`${day}-${slot}`}
                  className="col-span-1 p-2 border rounded relative"
                >
                  <button
                    onClick={() => handleCellClick(day, slot)}
                    className={`w-full h-full ${
                      isDateClosed(day) ? 'bg-gray-100 cursor-not-allowed' : ''
                    } ${
                      isSameDay(day, selectedDate) && selectedTimeSlot === slot
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    {getStatusDisplay(day, slotReservations)}
                  </button>
                  {!isDateClosed(day) && !isBlocked && slotReservations.length === 0 && (
                    <button
                      onClick={(e) => handleBlockClick(e, day, slot)}
                      className="absolute top-0 right-0 p-1 text-gray-500 hover:text-gray-700"
                      title="休枠設定"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <AdminReservationDialog
        open={showReservationDialog}
        onOpenChange={setShowReservationDialog}
        defaultDate={selectedDate}
        defaultTimeSlot={selectedTimeSlot}
      />

      <AdminReservationDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        reservation={selectedReservation}
      />

      <AdminCalendarEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        date={selectedDate}
        event={selectedEvent}
      />

      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>休枠の設定</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              {selectedDate && format(selectedDate, "yyyy年MM月dd日", { locale: ja })}の
              {selectedTimeSlot && TIME_SLOTS[selectedTimeSlot].start}
              の枠を休枠として設定します。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleBlockTimeSlot}>
              設定する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
