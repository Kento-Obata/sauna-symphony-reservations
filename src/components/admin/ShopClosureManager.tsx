import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopClosures } from "@/hooks/useShopClosures";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ShopClosureManager = () => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reason, setReason] = useState("");
  const { closures, addClosure, deleteClosure } = useShopClosures();
  const [selectedClosureDate, setSelectedClosureDate] = useState<string | null>(null);

  const handleAddClosures = async () => {
    if (selectedDates.length === 0) return;
    
    // Add closures one by one
    for (const date of selectedDates) {
      try {
        await addClosure.mutateAsync({
          date: format(date, "yyyy-MM-dd"),
          reason: reason || null,
        });
      } catch (error) {
        console.error("Failed to add closure for date:", date, error);
        toast.error(`${format(date, "yyyy/MM/dd")}の追加に失敗しました`);
      }
    }
    
    setSelectedDates([]);
    setReason("");
  };

  const handleDeleteClosure = (id: string) => {
    deleteClosure.mutate(id);
  };

  const isDateClosed = (date: Date) => {
    return closures?.some(
      (closure) => closure.date === format(date, "yyyy-MM-dd")
    );
  };

  const handleCalendarSelect = (dates: Date[] | undefined) => {
    if (!dates) return;

    const lastSelectedDate = dates[dates.length - 1];
    if (lastSelectedDate && isDateClosed(lastSelectedDate)) {
      // If the selected date is a closure date, show confirmation dialog
      const formattedDate = format(lastSelectedDate, "yyyy-MM-dd");
      const closure = closures?.find(c => c.date === formattedDate);
      if (closure) {
        setSelectedClosureDate(closure.id);
        return;
      }
    }
    
    setSelectedDates(dates);
  };

  const handleConfirmDelete = () => {
    if (selectedClosureDate) {
      handleDeleteClosure(selectedClosureDate);
      setSelectedClosureDate(null);
    }
  };

  return (
    <div className="space-y-6 glass-card p-6">
      <h2 className="text-xl font-semibold mb-4 text-foreground">休業日管理</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={handleCalendarSelect}
            className="rounded-md border"
            modifiers={{
              closed: (date) => isDateClosed(date),
            }}
            modifiersStyles={{
              closed: { backgroundColor: "rgb(239 68 68 / 0.1)" },
            }}
          />
          {selectedDates.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {selectedDates.length}日選択中
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Input
            placeholder="休業理由（任意）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            onClick={handleAddClosures}
            disabled={selectedDates.length === 0}
            className="w-full"
          >
            {selectedDates.length > 0
              ? `${selectedDates.length}日分の休業日を追加`
              : "休業日を追加"}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!selectedClosureDate} onOpenChange={() => setSelectedClosureDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>休業日を稼働日に変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した日付の休業設定を解除します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>いいえ</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>はい</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};