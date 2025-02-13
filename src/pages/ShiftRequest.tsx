
import { useState } from "react";
import { TimeSlot } from "@/types/reservation";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

const TIME_SLOTS = {
  morning: { label: "午前 (9:00-13:00)", start: "09:00", end: "13:00" },
  afternoon: { label: "午後 (13:00-17:00)", start: "13:00", end: "17:00" },
  evening: { label: "夜 (17:00-21:00)", start: "17:00", end: "21:00" },
} as const;

const ShiftRequest = () => {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const { data: preferences, refetch: refetchPreferences } = useQuery({
    queryKey: ["shift-preferences", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_preferences")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(addDays(weekStart, 6), "yyyy-MM-dd"));

      if (error) throw error;
      return data;
    },
  });

  const handlePreferenceClick = async (
    staffId: string,
    date: Date,
    timeSlot: TimeSlot,
    currentPreference?: "available" | "unavailable"
  ) => {
    const newPreference = currentPreference === "available" ? "unavailable" : "available";
    
    try {
      const { error } = await supabase
        .from("shift_preferences")
        .upsert(
          {
            staff_id: staffId,
            date: format(date, "yyyy-MM-dd"),
            time_slot: timeSlot,
            preference: newPreference,
          },
          { onConflict: "staff_id,date,time_slot" }
        );

      if (error) throw error;

      await refetchPreferences();
      
      toast({
        title: "成功",
        description: "シフト希望を更新しました",
      });
    } catch (error) {
      console.error("Error updating preference:", error);
      toast({
        title: "エラー",
        description: "シフト希望の更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  const getPreference = (staffId: string, date: Date, timeSlot: TimeSlot) => {
    return preferences?.find(
      (p) =>
        p.staff_id === staffId &&
        p.date === format(date, "yyyy-MM-dd") &&
        p.time_slot === timeSlot
    )?.preference;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">シフト希望登録</h1>
      
      <div className="mb-4 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
        >
          前週
        </Button>
        <span className="text-lg font-medium">
          {format(weekStart, "yyyy年MM月dd日", { locale: ja })} -{" "}
          {format(addDays(weekStart, 6), "MM月dd日", { locale: ja })}
        </span>
        <Button
          variant="outline"
          onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
        >
          次週
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2">時間帯</th>
              {weekDays.map((day) => (
                <th key={day.toString()} className="border p-2 min-w-[100px]">
                  {format(day, "M/d (E)", { locale: ja })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(TIME_SLOTS).map(([slot, { label }]) => (
              <tr key={slot}>
                <td className="border p-2 font-medium">{label}</td>
                {weekDays.map((day) => (
                  <td key={day.toString()} className="border p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {staffMembers?.map((staff) => {
                        const preference = getPreference(staff.id, day, slot as TimeSlot);
                        return (
                          <Button
                            key={staff.id}
                            variant="outline"
                            size="sm"
                            className={`w-full ${
                              preference === "available"
                                ? "bg-green-100 hover:bg-green-200"
                                : preference === "unavailable"
                                ? "bg-red-100 hover:bg-red-200"
                                : ""
                            }`}
                            onClick={() =>
                              handlePreferenceClick(staff.id, day, slot as TimeSlot, preference)
                            }
                          >
                            <span className="mr-1 text-xs">{staff.username}</span>
                            {preference === "available" ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : preference === "unavailable" ? (
                              <X className="h-4 w-4 text-red-600" />
                            ) : null}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShiftRequest;
