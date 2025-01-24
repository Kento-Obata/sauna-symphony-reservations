import { useState } from "react";
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const ShiftExportDialog = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const { data: shifts } = useQuery({
    queryKey: ["shifts", format(start, "yyyy-MM"), "export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          profiles:staff_id (
            username
          )
        `)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const formatShiftsText = () => {
    if (!shifts) return "";

    // Group shifts by staff member
    const shiftsByStaff: Record<string, typeof shifts> = {};
    shifts.forEach(shift => {
      const username = (shift.profiles as any)?.username || "Unknown";
      if (!shiftsByStaff[username]) {
        shiftsByStaff[username] = [];
      }
      shiftsByStaff[username].push(shift);
    });

    // Format text
    let text = `${format(start, "yyyy年MM月", { locale: ja })}のシフト\n\n`;

    Object.entries(shiftsByStaff).forEach(([username, staffShifts]) => {
      text += `■ ${username}\n`;
      staffShifts.forEach(shift => {
        const shiftDate = parseISO(shift.start_time);
        const startTime = format(parseISO(shift.start_time), "H:mm");
        const endTime = format(parseISO(shift.end_time), "H:mm");
        text += `${format(shiftDate, "M/d")} (${format(shiftDate, "E", { locale: ja })}) ${startTime}～${endTime}\n`;
      });
      text += "\n";
    });

    return text;
  };

  const handleCopy = () => {
    const text = formatShiftsText();
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "コピーしました",
        description: "シフト情報をクリップボードにコピーしました",
      });
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">シフト表をテキスト出力</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>シフト表</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center">
                {format(start, "yyyy年MM月", { locale: ja })}
              </span>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {formatShiftsText()}
          </pre>
        </ScrollArea>
        <div className="flex justify-end">
          <Button onClick={handleCopy}>クリップボードにコピー</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};