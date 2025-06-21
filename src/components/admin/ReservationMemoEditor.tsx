
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ReservationMemoEditorProps {
  reservationId: string;
  currentMemo?: string | null;
}

export const ReservationMemoEditor = ({ reservationId, currentMemo }: ReservationMemoEditorProps) => {
  const [memo, setMemo] = useState(currentMemo || "");
  const queryClient = useQueryClient();

  const updateMemo = useMutation({
    mutationFn: async (newMemo: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("reservations")
        .update({
          admin_memo: newMemo,
          admin_memo_updated_at: new Date().toISOString(),
          admin_memo_updated_by: user?.id,
        })
        .eq("id", reservationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("メモを更新しました");
      queryClient.invalidateQueries({ queryKey: ["customerReservations"] });
      queryClient.invalidateQueries({ queryKey: ["customerSearch"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => {
      toast.error("メモの更新に失敗しました");
    },
  });

  const handleSave = () => {
    updateMemo.mutate(memo);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          管理者メモ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="この予約に関するメモを入力してください..."
          rows={4}
        />
        <Button 
          onClick={handleSave}
          disabled={updateMemo.isPending}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {updateMemo.isPending ? "保存中..." : "保存"}
        </Button>
      </CardContent>
    </Card>
  );
};
