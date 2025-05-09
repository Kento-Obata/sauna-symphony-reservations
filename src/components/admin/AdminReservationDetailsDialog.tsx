import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Reservation, TimeSlot } from "@/types/reservation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ReservationDateSelect } from "./reservation-details/ReservationDateSelect";
import { ReservationTimeSelect } from "./reservation-details/ReservationTimeSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Option } from "@/types/option";

interface AdminReservationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
}

export const AdminReservationDetailsDialog = ({
  open,
  onOpenChange,
  reservation,
}: AdminReservationDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [waterTemperature, setWaterTemperature] = useState("15");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("morning");
  const [date, setDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reservationOptions, setReservationOptions] = useState<{option: Option, quantity: number}[]>([]);

  useEffect(() => {
    if (reservation) {
      setGuestName(reservation.guest_name);
      setGuestCount(reservation.guest_count.toString());
      setPhone(reservation.phone);
      setEmail(reservation.email || "");
      setWaterTemperature(reservation.water_temperature.toString());
      setTimeSlot(reservation.time_slot);
      setDate(reservation.date);
      fetchReservationOptions(reservation.id);
    }
  }, [reservation]);

  const fetchReservationOptions = async (reservationId: string) => {
    try {
      console.log("Fetching options for reservation ID:", reservationId);
      
      const { data, error } = await supabase
        .from("reservation_options")
        .select(`
          quantity,
          option_id,
          options(
            id, name, description, price_per_person, is_active, created_at, updated_at
          )
        `)
        .eq("reservation_id", reservationId);

      if (error) {
        console.error("Error fetching reservation options:", error);
        return;
      }

      if (data && data.length > 0) {
        const formattedOptions = data
          .filter(item => item.options) // Filter out any null options
          .map(item => ({
            option: item.options as Option,
            quantity: item.quantity
          }));
        setReservationOptions(formattedOptions);
        console.log("Formatted options:", formattedOptions);
      } else {
        setReservationOptions([]);
        console.log("No options found for this reservation");
      }
    } catch (error) {
      console.error("Error in fetchReservationOptions:", error);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return "仮予約";
      case "confirmed":
        return "予約確定";
      case "cancelled":
        return "キャン��ル済み";
      default:
        return status;
    }
  };

  // Calculate total options price
  const calculateOptionsTotal = () => {
    return reservationOptions.reduce((total, item) => {
      return total + (item.option.price_per_person * item.quantity);
    }, 0);
  };

  if (!reservation) return null;

  const handleSave = async () => {
    try {
      console.log("Updating reservation with data:", {
        guest_name: guestName,
        guest_count: parseInt(guestCount),
        phone: phone,
        email: email || null,
        water_temperature: 15,
        time_slot: timeSlot,
        date: date,
      });

      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: guestName,
          guest_count: parseInt(guestCount),
          phone: phone,
          email: email || null,
          water_temperature: 15,
          time_slot: timeSlot,
          date: date,
        })
        .eq("id", reservation.id);

      if (error) {
        console.error("Error updating reservation:", error);
        throw error;
      }

      const notificationResponse = await supabase.functions.invoke(
        "send-update-notification",
        {
          body: {
            date: date,
            timeSlot: timeSlot,
            guestName: guestName,
            guestCount: parseInt(guestCount),
            email: email || null,
            phone: phone,
            waterTemperature: 15,
            reservationCode: reservation.reservation_code,
          },
        }
      );

      if (notificationResponse.error) {
        console.error("通知の送信に失敗しました:", notificationResponse.error);
        toast.error("予約は更新されましたが、通知の送信に失敗しました");
      } else {
        toast.success("予約情報を更新しました");
      }

      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      await queryClient.invalidateQueries({ 
        queryKey: ["reservation", reservation.reservation_code] 
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("予約情報の更新に失敗しました");
    }
  };

  const handleCancel = async () => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservation.id);

      if (error) throw error;

      toast.success("予約をキャンセルしました");
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      toast.error("予約のキャンセルに失敗しました");
    }
  };

  const handleDateChange = (newDate: Date) => {
    setDate(format(newDate, "yyyy-MM-dd"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>予約詳細</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
            <ReservationDateSelect
              date={date}
              onDateChange={handleDateChange}
              isEditing={isEditing}
              currentReservationId={reservation.id}
            />

            <ReservationTimeSelect
              timeSlot={timeSlot}
              onTimeSlotChange={setTimeSlot}
              isEditing={isEditing}
              date={date}
              currentReservationId={reservation.id}
            />

            <div className="text-muted-foreground">お名前:</div>
            <div>
              {isEditing ? (
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              ) : (
                `${reservation.guest_name}様`
              )}
            </div>

            <div className="text-muted-foreground">人数:</div>
            <div>
              {isEditing ? (
                <Select value={guestCount} onValueChange={setGuestCount}>
                  <SelectTrigger>
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
              ) : (
                `${reservation.guest_count}名`
              )}
            </div>

            <div className="text-muted-foreground">電話番号:</div>
            <div>
              {isEditing ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              ) : (
                reservation.phone
              )}
            </div>

            <div className="text-muted-foreground">メールアドレス:</div>
            <div>
              {isEditing ? (
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              ) : (
                reservation.email || "-"
              )}
            </div>

            <div className="text-muted-foreground">水風呂温度:</div>
            <div>
              {isEditing ? (
                <>
                  <div className="text-sm text-muted-foreground mb-2 text-amber-600 font-medium">
                    ※ 水温選択は2024年9月より導入予定です
                  </div>
                  <Select value="15" onValueChange={setWaterTemperature} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15°C</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                `${reservation.water_temperature}°C`
              )}
            </div>

            {reservationOptions.length > 0 && (
              <>
                <div className="text-muted-foreground">選択オプション:</div>
                <div>
                  <ul className="space-y-2">
                    {reservationOptions.map((item, index) => (
                      <li key={index} className="bg-sauna-wood/10 p-2 rounded-lg border border-sauna-stone/10">
                        <div className="font-medium text-sm">{item.option.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(item.option.price_per_person)}/人 × {item.quantity}人 = {formatPrice(item.option.price_per_person * item.quantity)}
                        </div>
                        {item.option.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.option.description}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {reservationOptions.length > 0 && (
                    <div className="mt-3 bg-sauna-stone/10 p-2 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">オプション合計</span>
                        <span className="font-bold">
                          {formatPrice(calculateOptionsTotal())}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="text-muted-foreground">予約コード:</div>
            <div>{reservation.reservation_code}</div>

            <div className="text-muted-foreground">ステータス:</div>
            <div>
              {getStatusDisplay(reservation.status)}
            </div>

            <div className="text-muted-foreground">料金:</div>
            <div>
              {formatPrice(reservation.total_price)} (税込)
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSave}>保存</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      予約をキャンセル
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消すことができません。予約をキャンセルしてもよろしいですか？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>戻る</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        キャンセルする
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>編集</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
