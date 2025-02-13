
import { useState } from "react";
import { TimeSlot } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const TIME_SLOTS = {
  morning: { label: "午前 (9:00-13:00)", start: "09:00", end: "13:00" },
  afternoon: { label: "午後 (13:00-17:00)", start: "13:00", end: "17:00" },
  evening: { label: "夜 (17:00-21:00)", start: "17:00", end: "21:00" },
} as const;

const ShiftRequest = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>();
  const { toast } = useToast();

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

  const handleSubmit = async (staffId: string) => {
    if (!selectedDate || !selectedTimeSlot) {
      toast({
        title: "エラー",
        description: "日付と時間帯を選択してください",
        variant: "destructive",
      });
      return;
    }

    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const timeSlot = TIME_SLOTS[selectedTimeSlot];

    try {
      // Check for existing shifts
      const { data: existingShifts, error: checkError } = await supabase
        .from("shifts")
        .select("id")
        .eq("staff_id", staffId)
        .eq("start_time", `${formattedDate}T${timeSlot.start}:00+09:00`);

      if (checkError) throw checkError;

      if (existingShifts && existingShifts.length > 0) {
        toast({
          title: "エラー",
          description: "同じ日時に既にシフトが登録されています",
          variant: "destructive",
        });
        return;
      }

      // Insert new shift
      const { error: insertError } = await supabase.from("shifts").insert({
        staff_id: staffId,
        start_time: `${formattedDate}T${timeSlot.start}:00+09:00`,
        end_time: `${formattedDate}T${timeSlot.end}:00+09:00`,
        status: "scheduled",
      });

      if (insertError) throw insertError;

      toast({
        title: "成功",
        description: "仮シフトを登録しました",
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedTimeSlot(undefined);
    } catch (error) {
      console.error("Error submitting shift request:", error);
      toast({
        title: "エラー",
        description: "仮シフトの登録に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">仮シフト登録</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-background">
            <h2 className="text-lg font-semibold mb-4">日付を選択</h2>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ja}
              className="rounded-md border"
            />
          </div>

          <div className="p-4 border rounded-lg bg-background">
            <h2 className="text-lg font-semibold mb-4">時間帯を選択</h2>
            <Select
              value={selectedTimeSlot}
              onValueChange={(value: TimeSlot) => setSelectedTimeSlot(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="時間帯を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_SLOTS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 border rounded-lg bg-background">
            <h2 className="text-lg font-semibold mb-4">スタッフを選択</h2>
            <div className="grid grid-cols-2 gap-2">
              {staffMembers?.map((staff) => (
                <Button
                  key={staff.id}
                  onClick={() => handleSubmit(staff.id)}
                  className="w-full"
                  variant="outline"
                >
                  {staff.username}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-background">
          <h2 className="text-lg font-semibold mb-4">選択内容</h2>
          <div className="space-y-2">
            <p>
              日付:{" "}
              {selectedDate
                ? format(selectedDate, "yyyy年MM月dd日(E)", { locale: ja })
                : "未選択"}
            </p>
            <p>
              時間帯:{" "}
              {selectedTimeSlot ? TIME_SLOTS[selectedTimeSlot].label : "未選択"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftRequest;
