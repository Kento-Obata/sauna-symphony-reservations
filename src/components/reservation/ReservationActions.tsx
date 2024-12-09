import { Button } from "@/components/ui/button";
import { XCircle, Pencil } from "lucide-react";
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

interface ReservationActionsProps {
  status: string;
  setShowEditDialog: (show: boolean) => void;
  cancelReservation: UseMutationResult<void, Error, void, unknown>;
}

export const ReservationActions = ({
  status,
  setShowEditDialog,
  cancelReservation,
}: ReservationActionsProps) => {
  if (status === 'cancelled') return null;

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
  );
};