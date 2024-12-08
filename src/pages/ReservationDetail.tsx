import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ModifyReservationDialog } from "@/components/reservation/ModifyReservationDialog";
import { toast } from "sonner";
import { ReservationDetailsCard } from "@/components/reservation/ReservationDetailsCard";

const ReservationDetail = () => {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const navigate = useNavigate();
  const [showModifyDialog, setShowModifyDialog] = useState(false);

  console.log("Accessing reservation with code:", code);

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
      <ReservationDetailsCard
        reservation={reservation}
        onModify={() => setShowModifyDialog(true)}
        onCancel={handleCancel}
      />

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