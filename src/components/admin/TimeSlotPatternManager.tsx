import { useState } from "react";
import { Plus, Edit2, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TimeSlotPatternDialog } from "./TimeSlotPatternDialog";
import {
  useTimeSlotPatterns,
  useDeleteTimeSlotPattern,
  TimeSlotPattern,
} from "@/hooks/useTimeSlotPatterns";

export const TimeSlotPatternManager = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<TimeSlotPattern | null>(null);

  const { data: patterns, isLoading } = useTimeSlotPatterns();
  const deleteMutation = useDeleteTimeSlotPattern();

  const handleEdit = (pattern: TimeSlotPattern) => {
    setEditingPattern(pattern);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("このパターンを削除しますか？")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingPattern(null);
  };

  if (isLoading) return <div>読み込み中...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            営業時間パターン管理
          </CardTitle>
          <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新規パターン
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {patterns && patterns.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>パターン名</TableHead>
                <TableHead>午前</TableHead>
                <TableHead>午後</TableHead>
                <TableHead>夕方</TableHead>
                <TableHead>夜</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.morning_start.slice(0, 5)}-{p.morning_end.slice(0, 5)}</TableCell>
                  <TableCell>{p.afternoon_start.slice(0, 5)}-{p.afternoon_end.slice(0, 5)}</TableCell>
                  <TableCell>{p.evening_start.slice(0, 5)}-{p.evening_end.slice(0, 5)}</TableCell>
                  <TableCell>{p.night_start && p.night_end ? `${p.night_start.slice(0,5)}-${p.night_end.slice(0,5)}` : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}>
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
            パターンが登録されていません
          </div>
        )}
      </CardContent>

      <TimeSlotPatternDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingPattern={editingPattern}
      />
    </Card>
  );
};
