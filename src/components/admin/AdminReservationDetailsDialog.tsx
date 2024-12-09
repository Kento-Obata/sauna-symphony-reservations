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
  const [waterTemperature, setWaterTemperature] = useState("");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("morning");
  const [date, setDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (reservation) {
      setGuestName(reservation.guest_name);
      setGuestCount(reservation.guest_count.toString());
      setPhone(reservation.phone);
      setEmail(reservation.email || "");
      setWaterTemperature(reservation.water_temperature.toString());
      setTimeSlot(reservation.time_slot);
      setDate(reservation.date);
    }
  }, [reservation]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return "仮予約";
      case "confirmed":
        return "予約確定";
      case "cancelled":
        return "キャンセル済み";
      default:
        return status;
    }
  };

  if (!reservation) return null;

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: guestName,
          guest_count: parseInt(guestCount),
          phone: phone,
          email: email || null,
          water_temperature: parseInt(waterTemperature),
          time_slot: timeSlot,
          date: date,
        })
        .eq("id", reservation.id);

      if (error) throw error;

      // Send update notification
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
            waterTemperature: parseInt(waterTemperature),
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

      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("予約情報の更新に失敗しました");
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
                <Select value={waterTemperature} onValueChange={setWaterTemperature}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 16 }, (_, i) => i + 2).map((temp) => (
                      <SelectItem key={temp} value={temp.toString()}>
                        {temp}°C
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                `${reservation.water_temperature}°C`
              )}
            </div>

            <div className="text-muted-foreground">予約コード:</div>
            <div>{reservation.reservation_code}</div>

            <div className="text-muted-foreground">ステータス:</div>
            <div>
              {getStatusDisplay(reservation.status)}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSave}>保存</Button>
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
