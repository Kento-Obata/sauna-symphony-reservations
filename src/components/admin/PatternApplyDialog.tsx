import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTimeSlotPatterns, TimeSlotPattern } from "@/hooks/useTimeSlotPatterns";
import { useCreateDailyTimeSlot } from "@/hooks/useDailyTimeSlots";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PatternApplyDialog = ({ open, onOpenChange }: Props) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);

  const { data: patterns } = useTimeSlotPatterns();
  const queryClient = useQueryClient();

  const handleApply = async () => {
    if (!selectedPatternId || selectedDates.length === 0) return;
    const pattern = patterns?.find((p) => p.id === selectedPatternId);
    if (!pattern) return;

    setIsApplying(true);
    try {
      for (const date of selectedDates) {
        const dateStr = format(date, "yyyy-MM-dd");

        // Delete existing slots for this date
        await supabase
          .from("daily_time_slots")
          .delete()
          .eq("date", dateStr);

        // Insert 3 slots from pattern
        const slots = [
          { date: dateStr, time_slot: "morning" as const, start_time: pattern.morning_start, end_time: pattern.morning_end, is_active: true },
          { date: dateStr, time_slot: "afternoon" as const, start_time: pattern.afternoon_start, end_time: pattern.afternoon_end, is_active: true },
          { date: dateStr, time_slot: "evening" as const, start_time: pattern.evening_start, end_time: pattern.evening_end, is_active: true },
        ];

        const { error } = await supabase.from("daily_time_slots").insert(slots);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success(`${selectedDates.length}日にパターンを適用しました`);
      setSelectedDates([]);
      setSelectedPatternId("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error applying pattern:", error);
      toast.error("パターンの適用に失敗しました");
    } finally {
      setIsApplying(false);
    }
  };

  const selectedPattern = patterns?.find((p) => p.id === selectedPatternId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>パターンを日付に適用</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Select value={selectedPatternId} onValueChange={setSelectedPatternId}>
              <SelectTrigger>
                <SelectValue placeholder="パターンを選択" />
              </SelectTrigger>
              <SelectContent>
                {patterns?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPattern && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <div>午前: {selectedPattern.morning_start.slice(0, 5)}-{selectedPattern.morning_end.slice(0, 5)}</div>
              <div>午後: {selectedPattern.afternoon_start.slice(0, 5)}-{selectedPattern.afternoon_end.slice(0, 5)}</div>
              <div>夕方: {selectedPattern.evening_start.slice(0, 5)}-{selectedPattern.evening_end.slice(0, 5)}</div>
            </div>
          )}

          <div>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates || [])}
              locale={ja}
              className="rounded-md border"
            />
          </div>

          {selectedDates.length > 0 && (
            <div className="text-sm text-muted-foreground">
              選択中: {selectedDates.length}日
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button
            onClick={handleApply}
            disabled={!selectedPatternId || selectedDates.length === 0 || isApplying}
          >
            {isApplying ? "適用中..." : "適用"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
