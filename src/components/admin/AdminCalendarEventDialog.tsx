
import React, { useEffect, useState } from "react";
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
import { Option } from "@/types/option";
import { formatPrice } from "@/utils/priceCalculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

interface ReservationOption {
  option: Option;
  quantity: number;
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
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [optionDetails, setOptionDetails] = useState<ReservationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // イベントがスケジュールタイプの場合は予約情報を取得
  useEffect(() => {
    const fetchReservationDetails = async () => {
      if (!event || event.type !== 'schedule') return;
      
      setIsLoading(true);
      try {
        // イベントタイトルからIDを抽出（例: 予約 #xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
        const idMatch = event.title.match(/#([0-9a-f-]+)/i);
        if (!idMatch || !idMatch[1]) return;
        
        const reservationId = idMatch[1];
        setReservationId(reservationId);
        
        // 予約に関連するオプション情報を取得
        const { data: reservationOptions, error } = await supabase
          .from("reservation_options")
          .select(`
            quantity,
            options:option_id (
              id, name, description, price_per_person
            )
          `)
          .eq("reservation_id", reservationId);
          
        if (error) {
          console.error("オプション情報の取得に失敗しました:", error);
          return;
        }
        
        if (reservationOptions && reservationOptions.length > 0) {
          const formattedOptions = reservationOptions.map(item => ({
            option: item.options as unknown as Option,
            quantity: item.quantity
          }));
          setOptionDetails(formattedOptions);
        }
      } catch (error) {
        console.error("予約詳細の取得に失敗しました:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReservationDetails();
  }, [event]);

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

  // オプションの合計金額を計算
  const calculateOptionsTotal = () => {
    return optionDetails.reduce((total, item) => {
      return total + (item.option.price_per_person * item.quantity);
    }, 0);
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
          
          {/* オプション情報の表示（スケジュールタイプかつオプションがある場合のみ） */}
          {event?.type === 'schedule' && optionDetails.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">選択されたオプション</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <ul className="space-y-1 text-sm">
                  {optionDetails.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span>
                        {item.option.name} × {item.quantity}名様
                      </span>
                      <span className="font-medium">
                        {formatPrice(item.option.price_per_person * item.quantity)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between pt-2 border-t mt-2">
                    <span className="font-medium">オプション合計:</span>
                    <span className="font-medium">
                      {formatPrice(calculateOptionsTotal())}
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

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
