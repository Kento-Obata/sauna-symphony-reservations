
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
import { Trash2, Plus } from "lucide-react";
import { useOptions } from "@/hooks/useOptions";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";

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
  const { data: availableOptions } = useOptions();
  const [isDirty, setIsDirty] = useState(false);
  const [basePrice, setBasePrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);

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
        
        // 予約情報を取得（合計金額を含む）
        const { data: reservation, error: reservationError } = await supabase
          .from("reservations")
          .select("*")
          .eq("id", reservationId)
          .single();
          
        if (reservationError) {
          console.error("予約情報の取得に失敗しました:", reservationError);
          return;
        }
        
        if (reservation) {
          setTotalPrice(reservation.total_price);
        }
        
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
          
          // オプション料金の合計を計算
          const optionsTotal = formattedOptions.reduce((sum, item) => {
            if (item.option.pricing_type === 'flat') {
              return sum + (item.option.flat_price || 0);
            } else {
              return sum + (item.option.price_per_person * item.quantity);
            }
          }, 0);
          
          // ベース料金（合計金額 - オプション料金）を計算
          setBasePrice(reservation.total_price - optionsTotal);
        } else {
          // オプションがない場合は全額をベース料金とする
          setBasePrice(reservation.total_price);
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

  // 合計金額を再計算（ベース料金 + オプション料金）
  const recalculateTotal = () => {
    const optionsTotal = calculateOptionsTotal();
    const newTotal = basePrice + optionsTotal;
    setTotalPrice(newTotal);
    return newTotal;
  };

  // ベース料金の更新
  const handleBasePriceChange = (newBasePrice: number) => {
    setBasePrice(newBasePrice);
    const newTotal = newBasePrice + calculateOptionsTotal();
    setTotalPrice(newTotal);
    setIsDirty(true);
  };

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
        
        // オプションが変更された場合、予約オプションを更新
        if (event.type === 'schedule' && reservationId && isDirty) {
          // まずは既存のオプションを削除
          const { error: deleteError } = await supabase
            .from("reservation_options")
            .delete()
            .eq("reservation_id", reservationId);
            
          if (deleteError) {
            console.error("既存のオプションの削除に失敗しました:", deleteError);
            throw deleteError;
          }
          
          // 選択されたオプションがある場合は新しく挿入
          if (optionDetails.length > 0) {
            const newOptions = optionDetails.map(item => {
              // per_guestの場合はitem.quantityがすでに予約人数を反映している
              const effectiveQuantity = item.quantity;
              
              // Calculate total_price based on pricing_type
              let total_price: number;
              if (item.option.pricing_type === 'flat') {
                total_price = item.option.flat_price || 0;
              } else {
                total_price = item.option.price_per_person * effectiveQuantity;
              }

              return {
                reservation_id: reservationId,
                option_id: item.option.id,
                quantity: effectiveQuantity,
                total_price
              };
            });
            
            const { error: insertError } = await supabase
              .from("reservation_options")
              .insert(newOptions);
              
            if (insertError) {
              console.error("新しいオプションの追加に失敗しました:", insertError);
              throw insertError;
            }
          }
          
          // 予約の合計金額を更新
          const finalTotal = recalculateTotal();
          const { error: updateError } = await supabase
            .from("reservations")
            .update({ total_price: finalTotal })
            .eq("id", reservationId);
            
          if (updateError) {
            console.error("予約の合計金額の更新に失敗しました:", updateError);
            throw updateError;
          }
        }
        
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
      if (item.option.pricing_type === 'flat') {
        return total + (item.option.flat_price || 0);
      } else {
        return total + (item.option.price_per_person * item.quantity);
      }
    }, 0);
  };

  // オプションの追加
  const handleAddOption = () => {
    if (!availableOptions || availableOptions.length === 0) return;
    
    // デフォルトで最初のオプションを選択
    const newOption = {
      option: availableOptions[0],
      quantity: 1
    };
    
    setOptionDetails([...optionDetails, newOption]);
    setIsDirty(true);
    // オプション追加時に合計金額を再計算
    recalculateTotal();
  };

  // オプションの削除
  const handleRemoveOption = (index: number) => {
    const updatedOptions = [...optionDetails];
    updatedOptions.splice(index, 1);
    setOptionDetails(updatedOptions);
    setIsDirty(true);
    // オプション削除時に合計金額を再計算
    recalculateTotal();
  };

  // オプションの変更
  const handleOptionChange = (index: number, optionId: string) => {
    const option = availableOptions?.find(opt => opt.id === optionId);
    if (!option) return;
    
    const updatedOptions = [...optionDetails];
    updatedOptions[index] = {
      ...updatedOptions[index],
      option
    };
    
    setOptionDetails(updatedOptions);
    setIsDirty(true);
    // オプション変更時に合計金額を再計算
    recalculateTotal();
  };

  // 数量の変更
  const handleQuantityChange = (index: number, quantity: number) => {
    const updatedOptions = [...optionDetails];
    updatedOptions[index] = {
      ...updatedOptions[index],
      quantity
    };
    
    setOptionDetails(updatedOptions);
    setIsDirty(true);
    // 数量変更時に合計金額を再計算
    recalculateTotal();
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
          
          {/* スケジュールタイプの場合のみ料金とオプション編集を表示 */}
          {event?.type === 'schedule' && reservationId && (
            <>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">料金設定</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FormLabel className="w-24">ベース料金:</FormLabel>
                      <Input 
                        type="number" 
                        value={basePrice} 
                        onChange={(e) => handleBasePriceChange(Number(e.target.value))} 
                        className="w-32"
                      />
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-medium">合計金額:</span>
                      <span className="font-medium">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-3 flex flex-row justify-between items-center">
                  <CardTitle className="text-sm">オプション設定</CardTitle>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={handleAddOption}
                    className="h-7 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> 追加
                  </Button>
                </CardHeader>
                <CardContent className="py-2">
                  {optionDetails.length > 0 ? (
                    <div className="space-y-3">
                      {optionDetails.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={item.option.id}
                            onValueChange={(value) => handleOptionChange(index, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOptions?.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name} (
                                    {option.pricing_type === 'flat'
                                      ? `${formatPrice(option.flat_price || 0)}・一律`
                                      : `${formatPrice(option.price_per_person)}/人`
                                    })
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.option.pricing_type === 'per_person' && (
                            <Select
                              value={item.quantity.toString()}
                              onValueChange={(value) => handleQuantityChange(index, parseInt(value))}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6].map((num) => (
                                  <SelectItem key={num} value={num.toString()}>
                                    {num}名
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveOption(index)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="font-medium">オプション合計:</span>
                        <span className="font-medium">
                          {formatPrice(calculateOptionsTotal())}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">オプションはありません</p>
                  )}
                </CardContent>
              </Card>
            </>
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
