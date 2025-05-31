
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const ShiftRequestForm = () => {
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !startHour || !endHour) {
      toast.error("必須項目を入力してください");
      return;
    }

    if (parseInt(endHour) <= parseInt(startHour)) {
      toast.error("終了時間は開始時間より後に設定してください");
      return;
    }

    setIsLoading(true);
    
    try {
      // 実際のユーザーIDを取得する必要がある
      // 今は仮のIDを使用
      const staffId = "temp-user-id";
      
      const { error } = await supabase
        .from("shift_requests")
        .insert({
          staff_id: staffId,
          date,
          start_hour: parseInt(startHour),
          end_hour: parseInt(endHour),
          note: note.trim() || null,
        });

      if (error) throw error;

      toast.success("シフト希望を申請しました");
      
      // フォームをリセット
      setDate("");
      setStartHour("");
      setEndHour("");
      setNote("");
      
    } catch (error) {
      console.error("Error submitting shift request:", error);
      toast.error("申請に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="date">日付</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={format(new Date(), "yyyy-MM-dd")}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="startHour">開始時間</Label>
          <Select value={startHour} onValueChange={setStartHour}>
            <SelectTrigger>
              <SelectValue placeholder="開始時間を選択" />
            </SelectTrigger>
            <SelectContent>
              {hours.map((hour) => (
                <SelectItem key={hour} value={hour.toString()}>
                  {hour.toString().padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="endHour">終了時間</Label>
          <Select value={endHour} onValueChange={setEndHour}>
            <SelectTrigger>
              <SelectValue placeholder="終了時間を選択" />
            </SelectTrigger>
            <SelectContent>
              {hours.slice(1).map((hour) => (
                <SelectItem 
                  key={hour} 
                  value={hour.toString()}
                  disabled={startHour !== "" && hour <= parseInt(startHour)}
                >
                  {hour.toString().padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="note">備考</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="特記事項があれば入力してください"
          rows={3}
        />
      </div>
      
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "申請中..." : "シフト希望を申請"}
      </Button>
    </form>
  );
};
