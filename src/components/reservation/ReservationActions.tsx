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
import { addJstDays, getJstTodayYmd } from "@/utils/jstDate";

interface ReservationActionsProps {
  status: string;
  date: string;
  paymentStatus?: string;
  setShowEditDialog: (show: boolean) => void;
  cancelReservation: UseMutationResult<void, Error, string, unknown>;
}

export const ReservationActions = ({
  status,
  date,
  paymentStatus,
  setShowEditDialog,
  cancelReservation,
}: ReservationActionsProps) => {
  const [phoneInput, setPhoneInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (status === 'cancelled' || status === 'expired') return null;

  const isPendingPayment = status === 'pending_payment';
  const isPaid = paymentStatus === 'paid';

  // オンラインでキャンセルできるのは2日前まで(前日・当日はキャンセル料が発生するため店舗対応)。
  // JST基準で判定。決済待ちは金銭の授受が無いため日付によらずキャンセル可能
  const tooLate = date < addJstDays(getJstTodayYmd(), 2) && !isPendingPayment;

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
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
      {!isPendingPayment && (
        <button type="button" className="u-btn u-btn-ghost" onClick={() => setShowEditDialog(true)}>
          <Pencil className="h-4 w-4" strokeWidth={1.5} />
          予約を変更
        </button>
      )}

      {tooLate ? (
        <p className="text-sm text-muted-foreground">
          ※前日・当日のキャンセルはお電話かDMにてご連絡ください
        </p>
      ) : (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <button type="button" className="u-btn border border-[hsl(4_62%_42%/0.4)] text-[hsl(4,62%,42%)] hover:bg-[hsl(4,62%,42%)] hover:text-u-paper">
              <XCircle className="h-4 w-4" strokeWidth={1.5} />
              予約をキャンセル
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="u-site w-[calc(100%-1.5rem)] rounded-[1.5rem] border-0 bg-u-paper sm:rounded-[1.5rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="u-display font-medium tracking-[0.08em]">予約をキャンセルしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消すことができません
                {isPaid && (
                  <>
                    <br />
                    お支払いいただいた料金は全額返金いたします(カード会社により反映まで数日かかる場合があります)
                  </>
                )}
                <br />
                ご本人確認のため、予約時の電話番号の下4桁を入力してください
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
                className="mt-2 h-12 rounded-xl text-center text-lg tracking-[0.4em]"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPhoneInput("")} className="rounded-full">戻る</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={phoneInput.length !== 4}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                キャンセルする
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};