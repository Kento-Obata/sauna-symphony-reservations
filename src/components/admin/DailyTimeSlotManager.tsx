import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Edit2, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DailyTimeSlotDialog } from "./DailyTimeSlotDialog";
import {
  useDailyTimeSlots,
  useDeleteDailyTimeSlot,
} from "@/hooks/useDailyTimeSlots";
import { Database } from "@/integrations/supabase/types";

type DailyTimeSlot = Database["public"]["Tables"]["daily_time_slots"]["Row"];

export const DailyTimeSlotManager = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DailyTimeSlot | null>(null);
  
  const { data: timeSlots, isLoading } = useDailyTimeSlots();
  const deleteMutation = useDeleteDailyTimeSlot();

  const handleEdit = (slot: DailyTimeSlot) => {
    setEditingSlot(slot);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("この時間スロットを削除しますか？")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSlot(null);
  };

  const getTimeSlotLabel = (timeSlot: string) => {
    switch (timeSlot) {
      case "morning":
        return "午前";
      case "afternoon":
        return "午後";
      case "evening":
        return "夕方";
      default:
        return timeSlot;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "有効" : "無効"}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            日別時間スロット管理
          </CardTitle>
          <Button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {timeSlots && timeSlots.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>時間帯</TableHead>
                <TableHead>開始時間</TableHead>
                <TableHead>終了時間</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeSlots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>
                    {format(new Date(slot.date), "yyyy年MM月dd日", { locale: ja })}
                  </TableCell>
                  <TableCell>{getTimeSlotLabel(slot.time_slot)}</TableCell>
                  <TableCell>{slot.start_time.slice(0, 5)}</TableCell>
                  <TableCell>{slot.end_time.slice(0, 5)}</TableCell>
                  <TableCell>{getStatusBadge(slot.is_active)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(slot)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            設定された時間スロットがありません
          </div>
        )}
      </CardContent>

      <DailyTimeSlotDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingSlot={editingSlot}
      />
    </Card>
  );
};