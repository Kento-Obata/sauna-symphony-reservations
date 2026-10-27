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
  const selectedClosure = closures?.find((c) => c.id === selectedClosureDate);
  const todayYmd = format(new Date(), "yyyy-MM-dd");
  // イベント枠を登録した日は、自動でパブリックイベント日(イベントが紐づく休業日)になる
  const upcomingEventDays = (closures ?? []).filter((c) => c.event_id && c.date >= todayYmd);
  const isEventDay = (date: Date) =>
    closures?.some((c) => c.event_id && c.date === format(date, "yyyy-MM-dd"));

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
              closed: (date) => isDateClosed(date) && !isEventDay(date),
              eventDay: (date) => !!isEventDay(date),
            }}
            modifiersStyles={{
              closed: { backgroundColor: "rgb(239 68 68 / 0.1)" },
              eventDay: { backgroundColor: "rgb(82 102 78 / 0.18)", fontWeight: 600 },
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
          <div className="pt-4 text-sm">
            <p className="font-medium text-foreground">パブリックイベント日</p>
            <p className="mt-1 text-xs text-muted-foreground">
              イベント管理で枠を登録した日は自動でここに入り、貸切予約を止めます。予約カレンダーではイベントへの案内が出ます（イベントが公開中のときのみ）。枠を全て消すと解除されます。
            </p>
            {upcomingEventDays.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {upcomingEventDays.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
                    <span>{format(new Date(`${c.date}T00:00:00`), "M/d(E)", { locale: ja })}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {c.event?.title ?? "イベント"}
                      {c.event && c.event.status !== "published" && "（非公開）"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">予定はありません</p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!selectedClosureDate} onOpenChange={() => setSelectedClosureDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>休業日を稼働日に変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClosure?.event_id
                ? `この日はパブリックイベント日（${selectedClosure.event?.title ?? "イベント"}）です。解除すると貸切予約を受け付けるようになります。イベントの枠は残ります。`
                : "選択した日付の休業設定を解除します。"}
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