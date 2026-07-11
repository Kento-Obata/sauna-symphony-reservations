import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PublicEvent } from "@/types/event";
import { useEventReservationForm } from "@/hooks/useEventReservationForm";
import { formatEventDateLabel, formatEventTimeRange } from "@/utils/eventFormat";

interface EventReservationFormProps {
  event: PublicEvent;
  form: ReturnType<typeof useEventReservationForm>;
}

/** 選択済みの枠に対する予約者情報フォーム + 確認ダイアログ */
export const EventReservationForm = ({ event, form }: EventReservationFormProps) => {
  const {
    selectedSlot,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    people,
    setPeople,
    guestCount,
    totalPrice,
    maxSelectableGuests,
    showConfirmDialog,
    setShowConfirmDialog,
    handleSubmit,
    handleConfirmReservation,
    isSubmitting,
  } = form;

  if (!selectedSlot) {
    return (
      <p className="text-center text-sm font-mplus font-extralight text-black/60 py-4">
        ご希望の枠を選択すると、お客様情報の入力に進めます。
      </p>
    );
  }

  const priceLabel = totalPrice > 0
    ? `¥${totalPrice.toLocaleString()}`
    : event.price_note || "無料";

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="rounded-lg border border-sauna-stone/20 bg-sauna-base/40 p-4 text-sm font-mplus font-light">
          選択中の枠: {formatEventDateLabel(selectedSlot.date)}{" "}
          {formatEventTimeRange(selectedSlot.start_time, selectedSlot.end_time)}
          （残り{selectedSlot.remaining}名）
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-guest-name">お名前 *</Label>
          <Input
            id="event-guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田太郎"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-email">メールアドレス *</Label>
          <Input
            id="event-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
          />
          <p className="text-xs text-black/50 font-mplus font-extralight">
            予約確認・キャンセル用のリンクをお送りします。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-phone">電話番号 *</Label>
          <Input
            id="event-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="090-1234-5678"
          />
        </div>

        <div className="space-y-2">
          <Label>人数 *</Label>
          <Select value={people} onValueChange={setPeople}>
            <SelectTrigger>
              <SelectValue placeholder="人数を選択" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxSelectableGuests }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}名
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {guestCount > 0 && (
          <div className="rounded-lg border border-sauna-stone/20 p-4 text-sm font-mplus">
            <div className="flex justify-between">
              <span className="font-light">料金</span>
              <span className="font-medium">{priceLabel}</span>
            </div>
            {totalPrice > 0 && (
              <p className="text-xs text-black/50 mt-1 font-extralight">
                お一人様 ¥{event.price_per_person.toLocaleString()} × {guestCount}名
                {event.price_note ? `・${event.price_note}` : "・当日現地払い"}
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          予約する
        </Button>
      </form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約内容の確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-left">
                <div>イベント: {event.title}</div>
                <div>
                  日時: {formatEventDateLabel(selectedSlot.date)}{" "}
                  {formatEventTimeRange(selectedSlot.start_time, selectedSlot.end_time)}
                </div>
                <div>お名前: {name}</div>
                <div>人数: {guestCount}名</div>
                <div>料金: {priceLabel}</div>
                <div className="pt-2 text-xs">
                  この内容で予約を確定します。確認メールが {email} に送信されます。
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReservation();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "送信中..." : "予約を確定する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
