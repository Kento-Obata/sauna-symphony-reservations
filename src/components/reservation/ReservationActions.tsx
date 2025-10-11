import { Button } from "@/components/ui/button";
import { XCircle, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
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
import { UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

interface ReservationActionsProps {
  status: string;
  setShowEditDialog: (show: boolean) => void;
  cancelReservation: UseMutationResult<void, Error, string, unknown>;
}

export const ReservationActions = ({
  status,
  setShowEditDialog,
  cancelReservation,
}: ReservationActionsProps) => {
  const [phoneInput, setPhoneInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (status === 'cancelled') return null;

  const handleCancel = () => {
    if (phoneInput.length !== 4) {
      toast.error("電話番号の下4桁を入力してください");
      return;
    }
    cancelReservation.mutate(phoneInput);
    setIsDialogOpen(false);
    setPhoneInput("");
  };

  return (
    <div className="flex justify-end gap-4 mt-6">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setShowEditDialog(true)}
      >
        <Pencil className="h-4 w-4" />
        予約を変更
      </Button>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              この操作は取り消すことができません。
              <br />
              ご本人確認のため、予約時の電話番号の下4桁を入力してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="phone-verification">電話番号の下4桁</Label>
            <Input
              id="phone-verification"
              type="text"
              maxLength={4}
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="0000"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPhoneInput("")}>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={phoneInput.length !== 4}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              キャンセルする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};