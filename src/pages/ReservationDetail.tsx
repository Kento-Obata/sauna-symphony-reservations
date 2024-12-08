import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ModifyReservationDialog } from "@/components/reservation/ModifyReservationDialog";
import { toast } from "sonner";

const ReservationDetail = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [showModifyDialog, setShowModifyDialog] = useState(false);

  console.log("Reservation code from URL:", code);

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ["reservation", code],
    queryFn: async () => {
      if (!code) {
        console.error("No reservation code provided");
        throw new Error("予約コードが必要です");
      }

      console.log("Fetching reservation with code:", code);
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("reservation_code", code)
        .single();

      console.log("Supabase response:", { data, error });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      if (!data) {
        console.error("No reservation found for code:", code);
        throw new Error("予約が見つかりません");
      }

      return data;
    },
    enabled: Boolean(code),
    retry: false,
  });

  if (!code) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center space-y-4">
          <p className="text-sauna-stone">予約コードが必要です</p>
          <Button onClick={() => navigate("/")}>トップページへ戻る</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-sauna-stone/20 rounded w-1/4"></div>
          <div className="h-4 bg-sauna-stone/20 rounded w-1/2"></div>
          <div className="h-4 bg-sauna-stone/20 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center space-y-4">
          <p className="text-sauna-stone">予約が見つかりません</p>
          <Button onClick={() => navigate("/")}>トップページへ戻る</Button>
        </div>
      </div>
    );
  }

  const handleCancel = async () => {
    if (!reservation) return;

    const isConfirmed = window.confirm(
      "予約をキャンセルしてもよろしいですか？"
    );

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservation.id);

      if (error) throw error;

      toast.success("予約をキャンセルしました");
      navigate("/");
    } catch (error) {
      console.error("予約のキャンセルに失敗しました:", error);
      toast.error("予約のキャンセルに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="glass-card p-8 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gradient">予約詳細</h1>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h2 className="text-sm text-sauna-stone/60">予約コード</h2>
              <p className="text-lg">{reservation.reservation_code}</p>
            </div>
            
            <div>
              <h2 className="text-sm text-sauna-stone/60">ステータス</h2>
              <p className="text-lg capitalize">
                {reservation.status === "confirmed" ? "予約確定" : "キャンセル済み"}
              </p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">日付</h2>
              <p className="text-lg">
                {format(new Date(reservation.date), "yyyy年MM月dd日", { locale: ja })}
              </p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">時間帯</h2>
              <p className="text-lg">
                {reservation.time_slot === "morning" && "午前 10:00-12:30"}
                {reservation.time_slot === "afternoon" && "午後 13:30-16:00"}
                {reservation.time_slot === "evening" && "夕方 17:00-19:30"}
              </p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">お名前</h2>
              <p className="text-lg">{reservation.guest_name}</p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">人数</h2>
              <p className="text-lg">{reservation.guest_count}名</p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">メールアドレス</h2>
              <p className="text-lg">{reservation.email || "-"}</p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">電話番号</h2>
              <p className="text-lg">{reservation.phone}</p>
            </div>

            <div>
              <h2 className="text-sm text-sauna-stone/60">水風呂温度</h2>
              <p className="text-lg">{reservation.water_temperature}°C</p>
            </div>
          </div>

          {reservation.status === "confirmed" && (
            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => setShowModifyDialog(true)}>
                予約内容を変更
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                予約をキャンセル
              </Button>
            </div>
          )}
        </div>
      </div>

      {reservation && (
        <ModifyReservationDialog
          open={showModifyDialog}
          onOpenChange={setShowModifyDialog}
          reservation={reservation}
        />
      )}
    </div>
  );
};

export default ReservationDetail;