import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CalendarDate {
  date: string;
  day_of_week: number;
  is_holiday: boolean;
}

export const useCalendarDates = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["calendar-dates", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_dates")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0])
        .order("date");

      if (error) throw error;
      return data as CalendarDate[];
    },
  });
};