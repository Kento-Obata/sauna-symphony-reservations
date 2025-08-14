import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import {
  useCreateDailyTimeSlot,
  useUpdateDailyTimeSlot,
} from "@/hooks/useDailyTimeSlots";
import { Database } from "@/integrations/supabase/types";

type DailyTimeSlot = Database["public"]["Tables"]["daily_time_slots"]["Row"];
type TimeSlot = Database["public"]["Enums"]["time_slot"];

interface DailyTimeSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSlot?: DailyTimeSlot | null;
}

interface FormData {
  date: Date;
  time_slot: TimeSlot;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export const DailyTimeSlotDialog = ({
  open,
  onOpenChange,
  editingSlot,
}: DailyTimeSlotDialogProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const createMutation = useCreateDailyTimeSlot();
  const updateMutation = useUpdateDailyTimeSlot();

  const form = useForm<FormData>({
    defaultValues: {
      date: new Date(),
      time_slot: "morning",
      start_time: "10:00",
      end_time: "12:30",
      is_active: true,
    },
  });

  useEffect(() => {
    if (editingSlot) {
      form.reset({
        date: new Date(editingSlot.date),
        time_slot: editingSlot.time_slot,
        start_time: editingSlot.start_time,
        end_time: editingSlot.end_time,
        is_active: editingSlot.is_active,
      });
    } else {
      form.reset({
        date: new Date(),
        time_slot: "morning",
        start_time: "10:00",
        end_time: "12:30",
        is_active: true,
      });
    }
  }, [editingSlot, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const timeSlotData = {
        date: format(data.date, "yyyy-MM-dd"),
        time_slot: data.time_slot,
        start_time: data.start_time,
        end_time: data.end_time,
        is_active: data.is_active,
      };

      if (editingSlot) {
        await updateMutation.mutateAsync({
          id: editingSlot.id,
          updates: timeSlotData,
        });
      } else {
        await createMutation.mutateAsync(timeSlotData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving time slot:", error);
    }
  };

  const handleTimeSlotChange = (timeSlot: TimeSlot) => {
    // Set default times based on time slot
    const defaults = {
      morning: { start: "10:00", end: "12:30" },
      afternoon: { start: "13:30", end: "16:00" },
      evening: { start: "17:00", end: "19:30" },
    };

    const defaultTimes = defaults[timeSlot];
    form.setValue("start_time", defaultTimes.start);
    form.setValue("end_time", defaultTimes.end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingSlot ? "時間スロット編集" : "新規時間スロット作成"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>日付</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "yyyy年MM月dd日")
                          ) : (
                            <span>日付を選択</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time_slot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>時間帯</FormLabel>
                  <Select
                    onValueChange={(value: TimeSlot) => {
                      field.onChange(value);
                      handleTimeSlotChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="時間帯を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="morning">午前</SelectItem>
                      <SelectItem value="afternoon">午後</SelectItem>
                      <SelectItem value="evening">夕方</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時間</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>終了時間</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">有効状態</FormLabel>
                    <div className="text-[0.8rem] text-muted-foreground">
                      この時間スロットを有効にする
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingSlot ? "更新" : "作成"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};