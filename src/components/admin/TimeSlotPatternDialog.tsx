import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateTimeSlotPattern,
  useUpdateTimeSlotPattern,
  TimeSlotPattern,
} from "@/hooks/useTimeSlotPatterns";

interface Props {
  open: boolean;
  onOpenChange: () => void;
  editingPattern: TimeSlotPattern | null;
}

export const TimeSlotPatternDialog = ({ open, onOpenChange, editingPattern }: Props) => {
  const [name, setName] = useState("");
  const [morningStart, setMorningStart] = useState("10:00");
  const [morningEnd, setMorningEnd] = useState("12:30");
  const [afternoonStart, setAfternoonStart] = useState("13:30");
  const [afternoonEnd, setAfternoonEnd] = useState("16:00");
  const [eveningStart, setEveningStart] = useState("17:00");
  const [eveningEnd, setEveningEnd] = useState("19:30");

  const createMutation = useCreateTimeSlotPattern();
  const updateMutation = useUpdateTimeSlotPattern();

  useEffect(() => {
    if (editingPattern) {
      setName(editingPattern.name);
      setMorningStart(editingPattern.morning_start.slice(0, 5));
      setMorningEnd(editingPattern.morning_end.slice(0, 5));
      setAfternoonStart(editingPattern.afternoon_start.slice(0, 5));
      setAfternoonEnd(editingPattern.afternoon_end.slice(0, 5));
      setEveningStart(editingPattern.evening_start.slice(0, 5));
      setEveningEnd(editingPattern.evening_end.slice(0, 5));
    } else {
      setName("");
      setMorningStart("10:00");
      setMorningEnd("12:30");
      setAfternoonStart("13:30");
      setAfternoonEnd("16:00");
      setEveningStart("17:00");
      setEveningEnd("19:30");
    }
  }, [editingPattern, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      name,
      morning_start: morningStart,
      morning_end: morningEnd,
      afternoon_start: afternoonStart,
      afternoon_end: afternoonEnd,
      evening_start: eveningStart,
      evening_end: eveningEnd,
    };

    if (editingPattern) {
      updateMutation.mutate({ id: editingPattern.id, updates: data }, { onSuccess: onOpenChange });
    } else {
      createMutation.mutate(data, { onSuccess: onOpenChange });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingPattern ? "パターン編集" : "新規パターン"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>パターン名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：パターン①" />
          </div>
          <div className="space-y-3">
            {[
              { label: "午前", start: morningStart, end: morningEnd, setStart: setMorningStart, setEnd: setMorningEnd },
              { label: "午後", start: afternoonStart, end: afternoonEnd, setStart: setAfternoonStart, setEnd: setAfternoonEnd },
              { label: "夕方", start: eveningStart, end: eveningEnd, setStart: setEveningStart, setEnd: setEveningEnd },
            ].map(({ label, start, end, setStart, setEnd }) => (
              <div key={label} className="flex items-center gap-2">
                <Label className="w-12">{label}</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
                <span>-</span>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>キャンセル</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editingPattern ? "更新" : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
