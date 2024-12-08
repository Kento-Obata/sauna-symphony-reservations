import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Reservation } from "@/types/reservation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ModifyReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
}

export const ModifyReservationDialog = ({
  open,
  onOpenChange,
  reservation,
}: ModifyReservationDialogProps) => {
  const [name, setName] = useState(reservation.guest_name);
  const [email, setEmail] = useState(reservation.email || "");
  const [phone, setPhone] = useState(reservation.phone);
  const [people, setPeople] = useState(reservation.guest_count.toString());
  const [temperature, setTemperature] = useState(reservation.water_temperature.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: name,
          email: email || null,
          phone,
          guest_count: parseInt(people),
          water_temperature: parseInt(temperature),
        })
        .eq("id", reservation.id);

      if (error) throw error;

      toast.success("予約情報を更新しました");
      queryClient.invalidateQueries({ queryKey: ["reservation", reservation.reservation_code] });
      onOpenChange(false);
    } catch (error) {
      console.error("予約の更新に失敗しました:", error);
      toast.error("予約の更新に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>予約内容の変更</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-sauna-stone/80">
              ※日時の変更は一度キャンセルして、新規予約として取り直してください。
            </p>
          </div>

          <div>
            <label className="block text-sm mb-2">お名前 *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">メールアドレス</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-2">電話番号 *</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">人数 *</label>
            <Select onValueChange={setPeople} value={people}>
              <SelectTrigger>
                <SelectValue placeholder="人数を選択" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}名
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm mb-2">水風呂温度 *</label>
            <Select onValueChange={setTemperature} value={temperature}>
              <SelectTrigger>
                <SelectValue placeholder="温度を選択" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 16 }, (_, i) => i + 2).map((temp) => (
                  <SelectItem key={temp} value={temp.toString()}>
                    {temp}°C
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "更新中..." : "変更を保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};