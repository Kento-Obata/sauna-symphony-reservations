import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AdminEvent,
  reservedCount,
  useAdminEvents,
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
} from "@/hooks/useEventAdmin";
import { isValidEventSlug, eventSlugErrorMessage } from "@/utils/eventSlug";
import { EventSlotEditor } from "@/components/admin/EventSlotEditor";

interface EventFormValues {
  title: string;
  slug: string;
  description: string;
  venue: string;
  price_per_person: number;
  price_note: string;
  max_guests_per_reservation: number;
  status: string;
  payment_type: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  closed: "受付終了",
};

const STATUS_BADGE_VARIANTS: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

const emptyFormValues: EventFormValues = {
  title: "",
  slug: "",
  description: "",
  venue: "",
  price_per_person: 0,
  price_note: "",
  max_guests_per_reservation: 4,
  status: "draft",
  payment_type: "onsite",
};

/** イベント管理タブ本体: イベント一覧 + 作成/編集ダイアログ + 選択イベントの枠・予約管理 */
export const EventManager = () => {
  const { data: events, isLoading } = useAdminEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const form = useForm<EventFormValues>({ defaultValues: emptyFormValues });

  const selectedEvent = events?.find((event) => event.id === selectedEventId) ?? null;

  const openCreateDialog = () => {
    setEditingEvent(null);
    form.reset(emptyFormValues);
    setDialogOpen(true);
  };

  const openEditDialog = (event: AdminEvent) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      slug: event.slug,
      description: event.description ?? "",
      venue: event.venue ?? "",
      price_per_person: event.price_per_person,
      price_note: event.price_note ?? "",
      max_guests_per_reservation: event.max_guests_per_reservation,
      status: event.status,
      payment_type: event.payment_type,
    });
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const slug = values.slug.trim();
    if (!values.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    if (!isValidEventSlug(slug)) {
      toast.error(eventSlugErrorMessage);
      return;
    }
    if (values.payment_type === "prepaid" && (Number(values.price_per_person) || 0) <= 0) {
      toast.error("事前決済にする場合は料金（お一人様）を1円以上に設定してください");
      return;
    }
    const payload = {
      title: values.title.trim(),
      slug,
      description: values.description.trim() || null,
      venue: values.venue.trim() || null,
      price_per_person: Number(values.price_per_person) || 0,
      price_note: values.price_note.trim() || null,
      max_guests_per_reservation: Number(values.max_guests_per_reservation) || 4,
      status: values.status,
      payment_type: values.payment_type,
    };
    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, updates: payload });
    } else {
      await createEvent.mutateAsync(payload);
    }
    setDialogOpen(false);
  });

  const handleDelete = async () => {
    if (!deletingEvent) return;
    if (selectedEventId === deletingEvent.id) setSelectedEventId(null);
    await deleteEvent.mutateAsync(deletingEvent.id);
    setDeletingEvent(null);
  };

  const publicUrl = (slug: string) => `${window.location.origin}/events/${slug}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>イベント管理</CardTitle>
          <Button onClick={openCreateDialog} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新規イベント
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">読み込み中...</p>
          ) : !events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              イベントがまだありません。「新規イベント」から作成してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイトル</TableHead>
                  <TableHead>slug</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">単価</TableHead>
                  <TableHead className="text-right">枠数</TableHead>
                  <TableHead className="text-right">予約人数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const totalReserved = event.event_slots.reduce(
                    (sum, slot) => sum + reservedCount(slot),
                    0,
                  );
                  return (
                    <TableRow
                      key={event.id}
                      className={
                        selectedEventId === event.id
                          ? "bg-muted/50 cursor-pointer"
                          : "cursor-pointer"
                      }
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell className="text-muted-foreground">{event.slug}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANTS[event.status] ?? "secondary"}>
                          {STATUS_LABELS[event.status] ?? event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {event.price_per_person > 0
                          ? `¥${event.price_per_person.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">{event.event_slots.length}</TableCell>
                      <TableCell className="text-right">{totalReserved}名</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(event);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingEvent(event);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          <div className="text-sm text-muted-foreground">
            公開URL:{" "}
            <a
              href={publicUrl(selectedEvent.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {publicUrl(selectedEvent.slug)}
            </a>
            {selectedEvent.status !== "published" && "（公開中のみアクセス可能）"}
          </div>
          <EventSlotEditor event={selectedEvent} />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "イベントを編集" : "新規イベント"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">タイトル *</Label>
              <Input id="event-title" maxLength={100} {...form.register("title")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-slug">slug（URLの一部）*</Label>
              <Input id="event-slug" placeholder="summer-sauna-2026" {...form.register("slug")} />
              <p className="text-xs text-muted-foreground">
                公開URL: /events/&lt;slug&gt;。半角小文字英数字とハイフンのみ。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">説明</Label>
              <Textarea id="event-description" rows={4} {...form.register("description")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-venue">会場</Label>
              <Input id="event-venue" {...form.register("venue")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-price">お一人様料金（円）</Label>
                <Input
                  id="event-price"
                  type="number"
                  min={0}
                  {...form.register("price_per_person", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-max-guests">1予約あたりの上限人数</Label>
                <Input
                  id="event-max-guests"
                  type="number"
                  min={1}
                  max={20}
                  {...form.register("max_guests_per_reservation", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-price-note">料金備考</Label>
              <Input
                id="event-price-note"
                placeholder="当日現地払い（現金のみ）"
                {...form.register("price_note")}
              />
            </div>
            <div className="space-y-2">
              <Label>支払い方法</Label>
              <Select
                value={form.watch("payment_type")}
                onValueChange={(value) => form.setValue("payment_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">現地払い</SelectItem>
                  <SelectItem value="prepaid">事前決済（Square）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                事前決済では予約時に Square の決済ページで支払いが完了した時点で予約が確定します。
                変更は新規予約にのみ適用されます。
              </p>
            </div>
            <div className="space-y-2">
              <Label>状態</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">下書き（非公開）</SelectItem>
                  <SelectItem value="published">公開中（予約受付）</SelectItem>
                  <SelectItem value="closed">受付終了（非公開）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={createEvent.isPending || updateEvent.isPending}
              >
                {editingEvent ? "更新" : "作成"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>イベントを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingEvent?.title}」を削除します。予約が入っている枠がある場合は削除できません。
              受付だけ止めたい場合は状態を「受付終了」にしてください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
