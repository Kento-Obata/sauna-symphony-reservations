import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

  const createTimestamp = (date: Date, timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const timestamp = setMinutes(setHours(date, hours), minutes);
    return timestamp.toISOString();
  };

  const handleSave = async () => {
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
            <Label htmlFor="start" className="text-right">
              開始時間
            </Label>
            <Input
              id="start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="end" className="text-right">
              終了時間
            </Label>
            <Input
              id="end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="col-span-3"
            />
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