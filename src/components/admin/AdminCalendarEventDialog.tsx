import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AdminCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: Date | null;
  event?: {
    id: string;
    title: string;
    description?: string;
    type: "event" | "schedule" | "note";
  } | null;
}

interface FormData {
  title: string;
  description: string;
  type: "event" | "schedule" | "note";
}

export const AdminCalendarEventDialog = ({
  open,
  onOpenChange,
  date,
  event,
}: AdminCalendarEventDialogProps) => {
  const { register, handleSubmit, reset, setValue } = useForm<FormData>({
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      type: event?.type || "event",
    },
  });
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (event) {
      setValue("title", event.title);
      setValue("description", event.description || "");
      setValue("type", event.type);
    } else {
      reset();
    }
  }, [event, setValue, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (event) {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            title: data.title,
            description: data.description,
            type: data.type,
          })
          .eq("id", event.id);

        if (error) throw error;
        toast.success("イベントを更新しました");
      } else if (date) {
        const { error } = await supabase.from("calendar_events").insert({
          date: format(date, "yyyy-MM-dd"),
          title: data.title,
          description: data.description,
          type: data.type,
        });

        if (error) throw error;
        toast.success("イベントを作成しました");
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("エラーが発生しました");
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;
      toast.success("イベントを削除しました");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("エラーが発生しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? "イベントを編集" : "新規イベント"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Select
              defaultValue={event?.type || "event"}
              onValueChange={(value) => setValue("type", value as "event" | "schedule" | "note")}
            >
              <SelectTrigger>
                <SelectValue placeholder="タイプを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">イベント</SelectItem>
                <SelectItem value="schedule">スケジュール</SelectItem>
                <SelectItem value="note">メモ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input
              placeholder="タイトル"
              {...register("title", { required: true })}
            />
          </div>
          <div>
            <Textarea
              placeholder="詳細"
              {...register("description")}
            />
          </div>
          <div className="flex justify-between">
            {event && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                削除
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button type="submit">
                {event ? "更新" : "作成"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};