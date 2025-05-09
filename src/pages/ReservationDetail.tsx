
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { toast } from "sonner";
import { AdminReservationDetailsDialog } from "@/components/admin/AdminReservationDetailsDialog";
import { useState } from "react";
import { ReservationInfo } from "@/components/reservation/ReservationInfo";
import { ReservationActions } from "@/components/reservation/ReservationActions";

export const ReservationDetail = () => {
  const { code: reservationCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Add validation for reservationCode
  if (!reservationCode) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-500">
          予約コードが見つかりません
        </h1>
        <p className="mt-2 text-gray-600">
          URLをご確認の上、もう一度お試しください。
        </p>
        <Button 
          className="mt-4"
          onClick={() => navigate('/')}
        >
          トップページへ戻る
        </Button>
      </div>
    );
  }

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ["reservation", reservationCode],
    queryFn: async () => {
      console.log("Searching for reservation code:", reservationCode);
      
      const { data, error } = await supabase
        .from("reservations")
        .select()
        .eq("reservation_code", reservationCode)
        .maybeSingle();  // Changed from .single() to .maybeSingle()

      if (error) {
        console.error("Error fetching reservation:", error);
        throw error;
      }

      if (!data) {
        console.log("No reservation found with code:", reservationCode);
        return null;  // Return null instead of throwing error
      }

      console.log("Found reservation:", data);
      return data;
    },
    retry: false,
    enabled: !!reservationCode,
  });

  const cancelReservation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reservations")
        .update({ 
          status: "cancelled",
          // キャンセル時には is_confirmed を true に設定
          // これにより期限切れ処理から確実に除外される
          is_confirmed: true 
        })
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
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-500">
            予約情報の取得に失敗しました
          </h1>
          <p className="mt-2 text-gray-600">
            もう一度お試しいただくか、管理者にお問い合わせください。
          </p>
          <Button 
            className="mt-4"
            onClick={() => navigate('/')}
          >
            トップページへ戻る
          </Button>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-500">
            予約が見つかりませんでした
          </h1>
          <p className="mt-2 text-gray-600">
            予約コードをご確認の上、もう一度お試しください。
          </p>
          <Button 
            className="mt-4"
            onClick={() => navigate('/')}
          >
            トップページへ戻る
          </Button>
        </div>
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
          <ReservationInfo reservation={reservation} />
          <ReservationActions 
            status={reservation.status}
            setShowEditDialog={setShowEditDialog}
            cancelReservation={cancelReservation}
          />
        </div>
      </div>

      {reservation && (
        <AdminReservationDetailsDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          reservation={reservation}
        />
      )}
    </div>
  );
};

export default ReservationDetail;
