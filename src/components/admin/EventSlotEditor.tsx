import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AdminEvent,
  AdminEventSlot,
  reservedCount,
  useCreateEventSlot,
  useDeleteEventSlot,
  useUpdateEventSlot,
} from "@/hooks/useEventAdmin";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";
import { EventReservationList } from "@/components/admin/EventReservationList";

interface EventSlotEditorProps {
  event: AdminEvent;
}

/** 選択中イベントの枠一覧（追加・定員変更・有効切替・削除）+ 予約一覧 */
export const EventSlotEditor = ({ event }: EventSlotEditorProps) => {
  const createSlot = useCreateEventSlot();
  const updateSlot = useUpdateEventSlot();
  const deleteSlot = useDeleteEventSlot();

  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [newCapacity, setNewCapacity] = useState("10");

  const handleAddSlot = async () => {
    if (!newDate) {
      toast.error("日付を入力してください");
      return;
    }
    if (!newStart || !newEnd || newStart >= newEnd) {
      toast.error("開始・終了時間を正しく入力してください");
      return;
    }
    const capacity = parseInt(newCapacity);
    if (!Number.isInteger(capacity) || capacity < 0) {
      toast.error("定員は0以上の整数で入力してください");
      return;
    }
    await createSlot.mutateAsync({
      event_id: event.id,
      date: newDate,
      start_time: newStart,
      end_time: newEnd,
      capacity,
    });
  };

  const handleCapacityChange = (slot: AdminEventSlot, value: string) => {
    const capacity = parseInt(value);
    if (!Number.isInteger(capacity) || capacity < 0) return;
    const reserved = reservedCount(slot);
    if (capacity < reserved) {
      toast.warning(
        `定員(${capacity})が予約済み人数(${reserved})を下回っています。残席は0名として表示されます。`,
      );
    }
    updateSlot.mutate({ id: slot.id, updates: { capacity } });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">枠と定員（{event.title}）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] items-end">
            <div className="space-y-1">
              <Label htmlFor="new-slot-date">日付</Label>
              <Input
                id="new-slot-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-slot-start">開始</Label>
              <Input
                id="new-slot-start"
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-slot-end">終了</Label>
              <Input
                id="new-slot-end"
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-slot-capacity">定員</Label>
              <Input
                id="new-slot-capacity"
                type="number"
                min={0}
                className="w-24"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddSlot}
              disabled={createSlot.isPending}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              枠を追加
            </Button>
          </div>

          {event.event_slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">枠がまだありません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead className="text-right">定員</TableHead>
                  <TableHead className="text-right">予約済み</TableHead>
                  <TableHead className="text-center">受付</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.event_slots.map((slot) => {
                  const reserved = reservedCount(slot);
                  const overbooked = reserved > slot.capacity;
                  return (
                    <TableRow key={slot.id}>
                      <TableCell>{formatEventDateLabel(slot.date)}</TableCell>
                      <TableCell>
                        {formatEventTimeRange(slot.start_time, slot.end_time)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 ml-auto text-right"
                          defaultValue={slot.capacity}
                          onBlur={(e) => {
                            if (e.target.value !== String(slot.capacity)) {
                              handleCapacityChange(slot, e.target.value);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right ${overbooked ? "text-red-600 font-medium" : ""}`}
                      >
                        {reserved} / {slot.capacity}名
                        {overbooked && "（定員超過）"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={slot.is_active}
                          onCheckedChange={(checked) =>
                            updateSlot.mutate({ id: slot.id, updates: { is_active: checked } })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (slot.event_reservations.length > 0) {
                              toast.error(
                                "予約が存在するため削除できません。受付を止める場合はスイッチをオフにしてください。",
                              );
                              return;
                            }
                            deleteSlot.mutate(slot.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EventReservationList event={event} />
    </div>
  );
};
