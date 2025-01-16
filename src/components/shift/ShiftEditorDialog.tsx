import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

interface ShiftEditorDialogProps {
  date: Date;
  staffId?: string;
  startTime?: string;
  endTime?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  shiftId?: string;
}

// Generate time options from 8:00 to 22:00 in 30-minute increments
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 8; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      // Skip 22:30 as it's past our end time
      if (hour === 22 && minute === 30) continue;
      
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push(timeString);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export const ShiftEditorDialog = ({
  date,
  staffId,
  startTime,
  endTime,
  isOpen,
  onOpenChange,
  mode,
  shiftId,
}: ShiftEditorDialogProps) => {
  const [selectedStaff, setSelectedStaff] = useState(staffId || "");
  const [start, setStart] = useState(startTime || "");
  const [end, setEnd] = useState(endTime || "");
  const queryClient = useQueryClient();

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

  const createTimestamp = (date: Date, timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const timestamp = setMinutes(setHours(date, hours), minutes);
    return timestamp.toISOString();
  };

  const handleSave = async () => {
    if (!selectedStaff) {
      console.error("Staff member must be selected");
      return;
    }

    if (!start || !end) {
      console.error("Start and end times must be set");
      return;
    }

    const startTimestamp = createTimestamp(date, start);
    const endTimestamp = createTimestamp(date, end);

    if (mode === "create") {
      const { error } = await supabase.from("shifts").insert({
        staff_id: selectedStaff,
        start_time: startTimestamp,
        end_time: endTimestamp,
      });

      if (error) {
        console.error("Error creating shift:", error);
        return;
      }
    } else {
      const { error } = await supabase
        .from("shifts")
        .update({
          staff_id: selectedStaff,
          start_time: startTimestamp,
          end_time: endTimestamp,
        })
        .eq("id", shiftId);

      if (error) {
        console.error("Error updating shift:", error);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "シフトの追加" : "シフトの編集"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              日付
            </Label>
            <Input
              id="date"
              value={format(date, "yyyy年MM月dd日", { locale: ja })}
              className="col-span-3"
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="staff" className="text-right">
              スタッフ
            </Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {staffMembers?.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="start" className="text-right">
              開始時間
            </Label>
            <Select value={start} onValueChange={setStart}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="開始時間を選択" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="end" className="text-right">
              終了時間
            </Label>
            <Select value={end} onValueChange={setEnd}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="終了時間を選択" />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((time) => (
                  <SelectItem 
                    key={time} 
                    value={time}
                    disabled={time <= start} // Disable times before or equal to start time
                  >
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};