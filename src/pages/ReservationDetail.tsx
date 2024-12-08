import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Home, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TIME_SLOTS = {
  morning: "10:00-12:30",
  afternoon: "13:30-16:00",
  evening: "17:00-19:30",
};

const ReservationDetail = () => {
  const { reservationCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ["reservation", reservationCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("reservation_code", reservationCode)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("reservation_code", reservationCode);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationCode] });
      toast.success("予約をキャンセルしました");
    },
    onError: () => {
      toast.error("予約のキャンセルに失敗しました");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-500">
          予約情報が見つかりませんでした
        </h1>
        <p className="mt-2 text-gray-600">
          予約コードをご確認の上、もう一度お試しください。
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="glass-card p-6 max-w-2xl mx-auto relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4"
          onClick={() => navigate('/')}
        >
          <Home className="h-6 w-6 text-sauna-stone" />
        </Button>

        <h1 className="text-3xl font-bold mb-6 text-center text-gradient">
          予約詳細
        </h1>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-sauna-stone">予約コード:</div>
            <div>{reservation.reservation_code}</div>
            
            <div className="text-sauna-stone">日付:</div>
            <div>{format(new Date(reservation.date), "yyyy年MM月dd日")}</div>
            
            <div className="text-sauna-stone">時間:</div>
            <div>{TIME_SLOTS[reservation.time_slot]}</div>
            
            <div className="text-sauna-stone">お名前:</div>
            <div>{reservation.guest_name}</div>
            
            <div className="text-sauna-stone">人数:</div>
            <div>{reservation.guest_count}名</div>
            
            <div className="text-sauna-stone">電話番号:</div>
            <div>{reservation.phone}</div>
            
            {reservation.email && (
              <>
                <div className="text-sauna-stone">メールアドレス:</div>
                <div>{reservation.email}</div>
              </>
            )}
            
            <div className="text-sauna-stone">水風呂温度:</div>
            <div>{reservation.water_temperature}°C</div>

            <div className="text-sauna-stone">ステータス:</div>
            <div className={reservation.status === 'cancelled' ? 'text-red-500' : 'text-green-500'}>
              {reservation.status === 'cancelled' ? 'キャンセル済み' : '予約確定'}
            </div>
          </div>

          {reservation.status !== 'cancelled' && (
            <div className="flex justify-end gap-4 mt-6">
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
                      onClick={() => cancelReservation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      キャンセルする
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationDetail;