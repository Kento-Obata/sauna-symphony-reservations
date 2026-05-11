import { useState, useMemo, useEffect } from "react";
import { format, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTimeSlotPatterns, TimeSlotPattern } from "@/hooks/useTimeSlotPatterns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { enumerateWeekendsAndHolidays, isHoliday, isWeekend } from "@/utils/holidayUtils";
import { RULE_DEFAULT_4SLOT_FROM } from "@/utils/timeSlotRules";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TimeSlotName = "morning" | "afternoon" | "evening" | "night";

const buildSlots = (dateStr: string, pattern: TimeSlotPattern) => {
  const slots: Array<{ date: string; time_slot: TimeSlotName; start_time: string; end_time: string; is_active: boolean }> = [
    { date: dateStr, time_slot: "morning", start_time: pattern.morning_start, end_time: pattern.morning_end, is_active: true },
    { date: dateStr, time_slot: "afternoon", start_time: pattern.afternoon_start, end_time: pattern.afternoon_end, is_active: true },
    { date: dateStr, time_slot: "evening", start_time: pattern.evening_start, end_time: pattern.evening_end, is_active: true },
  ];
  if (pattern.night_start && pattern.night_end) {
    slots.push({ date: dateStr, time_slot: "night", start_time: pattern.night_start, end_time: pattern.night_end, is_active: true });
  }
  return slots;
};

export const PatternApplyDialog = ({ open, onOpenChange }: Props) => {
  // 個別選択
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string>("");

  // 範囲一括
  const [bulkPatternId, setBulkPatternId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("2026-06-06");
  const [endDate, setEndDate] = useState<string>(() => format(addMonths(new Date("2026-06-06"), 3), "yyyy-MM-dd"));
  const [weekendsOnly, setWeekendsOnly] = useState(true);
  const [reservedDates, setReservedDates] = useState<Set<string>>(new Set());
  const [loadingReserved, setLoadingReserved] = useState(false);

  const [isApplying, setIsApplying] = useState(false);
  const { data: patterns } = useTimeSlotPatterns();
  const queryClient = useQueryClient();

  // 「土日4枠」を初期パターンに
  useEffect(() => {
    if (!bulkPatternId && patterns?.length) {
      const def = patterns.find((p) => p.name.includes("土日4枠")) ?? patterns.find((p) => p.night_start);
      if (def) setBulkPatternId(def.id);
    }
  }, [patterns, bulkPatternId]);

  // 既存予約のある日付をロード（範囲一括タブ用）
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingReserved(true);
      const { data, error } = await supabase
        .from("reservations")
        .select("date")
        .gte("date", startDate)
        .lte("date", endDate)
        .in("status", ["confirmed", "pending"]);
      if (!error && data) {
        setReservedDates(new Set(data.map((r) => r.date)));
      }
      setLoadingReserved(false);
    };
    load();
  }, [open, startDate, endDate]);

  // プレビュー対象日
  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const candidates = weekendsOnly
        ? enumerateWeekendsAndHolidays(s, e)
        : (() => {
            const out: Date[] = [];
            const cur = new Date(s);
            while (cur <= e) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
            return out;
          })();
      return candidates.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const skip = reservedDates.has(dateStr);
        const tag = isHoliday(d) ? "祝" : isWeekend(d) ? (d.getDay() === 0 ? "日" : "土") : "";
        return { date: d, dateStr, skip, tag };
      });
    } catch {
      return [];
    }
  }, [startDate, endDate, weekendsOnly, reservedDates]);

  const applySlots = async (dates: string[], patternId: string) => {
    const pattern = patterns?.find((p) => p.id === patternId);
    if (!pattern) throw new Error("パターンが見つかりません");
    const allSlots = dates.flatMap((dateStr) => buildSlots(dateStr, pattern));
    const { error } = await supabase
      .from("daily_time_slots")
      .upsert(allSlots, { onConflict: "date,time_slot" });
    if (error) throw error;
  };

  const handleApplyIndividual = async () => {
    if (!selectedPatternId || selectedDates.length === 0) return;
    setIsApplying(true);
    try {
      await applySlots(selectedDates.map((d) => format(d, "yyyy-MM-dd")), selectedPatternId);
      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success(`${selectedDates.length}日にパターンを適用しました`);
      setSelectedDates([]);
      setSelectedPatternId("");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("パターンの適用に失敗しました");
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyBulk = async () => {
    if (!bulkPatternId) return;
    const target = previewDates.filter((p) => !p.skip).map((p) => p.dateStr);
    const skipped = previewDates.filter((p) => p.skip).length;
    if (target.length === 0) {
      toast.error("適用対象の日付がありません");
      return;
    }
    setIsApplying(true);
    try {
      await applySlots(target, bulkPatternId);
      queryClient.invalidateQueries({ queryKey: ["daily_time_slots"] });
      toast.success(`${target.length}日に適用、${skipped}日はスキップ（既存予約あり）`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("パターンの適用に失敗しました");
    } finally {
      setIsApplying(false);
    }
  };

  const selectedPattern = patterns?.find((p) => p.id === selectedPatternId);
  const bulkPattern = patterns?.find((p) => p.id === bulkPatternId);
  const applyCount = previewDates.filter((p) => !p.skip).length;
  const skipCount = previewDates.filter((p) => p.skip).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>パターンを日付に適用</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bulk" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bulk">範囲一括（土日祝）</TabsTrigger>
            <TabsTrigger value="individual">個別選択</TabsTrigger>
          </TabsList>

          {/* ========== 範囲一括 ========== */}
          <TabsContent value="bulk" className="space-y-4">
            <div>
              <Label>適用パターン</Label>
              <Select value={bulkPatternId} onValueChange={setBulkPatternId}>
                <SelectTrigger><SelectValue placeholder="パターンを選択" /></SelectTrigger>
                <SelectContent>
                  {patterns?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkPattern && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md space-y-0.5">
                <div>午前: {bulkPattern.morning_start.slice(0,5)}-{bulkPattern.morning_end.slice(0,5)}</div>
                <div>午後: {bulkPattern.afternoon_start.slice(0,5)}-{bulkPattern.afternoon_end.slice(0,5)}</div>
                <div>夕方: {bulkPattern.evening_start.slice(0,5)}-{bulkPattern.evening_end.slice(0,5)}</div>
                {bulkPattern.night_start && bulkPattern.night_end && (
                  <div>夜: {bulkPattern.night_start.slice(0,5)}-{bulkPattern.night_end.slice(0,5)}</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>開始日</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>終了日</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="weekendsOnly" checked={weekendsOnly} onCheckedChange={(v) => setWeekendsOnly(!!v)} />
              <Label htmlFor="weekendsOnly" className="cursor-pointer">土日祝のみを対象にする</Label>
            </div>

            <div className="border rounded-md p-3 max-h-64 overflow-y-auto bg-background">
              <div className="text-sm font-medium mb-2">
                対象 {applyCount}日 / スキップ {skipCount}日（既存予約あり）
                {loadingReserved && <span className="text-muted-foreground ml-2">予約確認中...</span>}
              </div>
              {previewDates.length === 0 ? (
                <div className="text-sm text-muted-foreground">対象日がありません</div>
              ) : (
                <ul className="text-sm space-y-0.5">
                  {previewDates.map((p) => (
                    <li key={p.dateStr} className={p.skip ? "text-muted-foreground line-through" : ""}>
                      {format(p.date, "yyyy/MM/dd (E)", { locale: ja })}
                      {p.tag && <span className="ml-1 text-xs">[{p.tag}]</span>}
                      {p.skip && <span className="ml-2 text-xs text-destructive">予約あり → スキップ</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
              <Button onClick={handleApplyBulk} disabled={!bulkPatternId || applyCount === 0 || isApplying}>
                {isApplying ? "適用中..." : `${applyCount}日に適用`}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ========== 個別選択 ========== */}
          <TabsContent value="individual" className="space-y-4">
            <div>
              <Select value={selectedPatternId} onValueChange={setSelectedPatternId}>
                <SelectTrigger><SelectValue placeholder="パターンを選択" /></SelectTrigger>
                <SelectContent>
                  {patterns?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPattern && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <div>午前: {selectedPattern.morning_start.slice(0,5)}-{selectedPattern.morning_end.slice(0,5)}</div>
                <div>午後: {selectedPattern.afternoon_start.slice(0,5)}-{selectedPattern.afternoon_end.slice(0,5)}</div>
                <div>夕方: {selectedPattern.evening_start.slice(0,5)}-{selectedPattern.evening_end.slice(0,5)}</div>
                {selectedPattern.night_start && selectedPattern.night_end && (
                  <div>夜: {selectedPattern.night_start.slice(0,5)}-{selectedPattern.night_end.slice(0,5)}</div>
                )}
              </div>
            )}

            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates || [])}
              locale={ja}
              className="rounded-md border"
            />

            {selectedDates.length > 0 && (
              <div className="text-sm text-muted-foreground">選択中: {selectedDates.length}日</div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
              <Button onClick={handleApplyIndividual} disabled={!selectedPatternId || selectedDates.length === 0 || isApplying}>
                {isApplying ? "適用中..." : "適用"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
