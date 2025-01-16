import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useShopClosures } from "@/hooks/useShopClosures";
import { toast } from "sonner";

export const ShopClosureManager = () => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reason, setReason] = useState("");
  const { closures, addClosure, deleteClosure } = useShopClosures();

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

  return (
    <div className="space-y-6 glass-card p-6">
      <h2 className="text-xl font-semibold mb-4 text-foreground">休業日管理</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={setSelectedDates}
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

        <div className="space-y-4">
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

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">休業日一覧</h3>
            {closures?.map((closure) => (
              <div
                key={closure.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div>
                  <div className="text-foreground">
                    {format(new Date(closure.date), "yyyy年MM月dd日(E)", {
                      locale: ja,
                    })}
                  </div>
                  {closure.reason && (
                    <div className="text-sm text-muted-foreground">
                      {closure.reason}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClosure(closure.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};