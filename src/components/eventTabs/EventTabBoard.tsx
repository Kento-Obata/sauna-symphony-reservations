import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEventTimeRange } from "@/utils/eventFormat";
import { EventTabGuest, EventTabItem, formatYen, tabTotal, useEventTabBoard } from "./eventTabs";
import { GuestTabDialog } from "./GuestTabDialog";
import { WalkinDialog } from "./WalkinDialog";

interface EventTabBoardProps {
  /** スタッフ用リンクのトークン。管理画面では null（ログイン中の管理者として呼ぶ） */
  token: string | null;
}

const jstNow = () => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  const [date, time] = parts.split(" ");
  return { date, time };
};

const lineSummary = (guest: EventTabGuest, items: EventTabItem[]) =>
  guest.lines
    .map((line) => `${items.find((i) => i.id === line.item_id)?.name ?? "?"}×${line.quantity}`)
    .join(" ");

const slotLabel = (date: string, start: string, end: string, showDate: boolean) =>
  `${showDate ? `${date.slice(5).replace("-", "/")} ` : ""}${formatEventTimeRange(start, end)}`;

/** イベント当日のお客さん一覧。お客さんを押すとオプションの記録と精算ができる */
export const EventTabBoard = ({ token }: EventTabBoardProps) => {
  const [eventId, setEventId] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [walkinOpen, setWalkinOpen] = useState(false);

  const { data, isLoading, error } = useEventTabBoard(token, eventId);

  const now = jstNow();
  const slots = useMemo(() => data?.slots ?? [], [data]);
  const multiDay = new Set(slots.map((s) => s.date)).size > 1;
  // 今の時間の枠（なければ今日の次の枠）を飛び込みの既定にする
  const currentSlotId =
    slots.find((s) => s.date === now.date && s.start_time <= now.time && now.time < s.end_time)?.id ??
    slots.find((s) => s.date === now.date && now.time < s.start_time)?.id ??
    null;

  const guests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.guests ?? []).filter(
      (g) =>
        (slotFilter === "all" || g.slot_id === slotFilter) &&
        (!q ||
          g.guest_name.toLowerCase().includes(q) ||
          (g.reservation_code ?? "").toLowerCase().includes(q)),
    );
  }, [data, query, slotFilter]);

  if (error) {
    const message = (error as { message?: string }).message;
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {message === "invalid_token"
          ? "このリンクは使えません。管理者に新しいリンクをもらってください"
          : "読み込めませんでした。時間をおいて開き直してください"}
      </p>
    );
  }
  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">読み込み中...</p>;
  }
  if (!data.event) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {data.is_admin ? "イベントがありません" : "今日の前後にイベントはありません"}
      </p>
    );
  }

  const unsettled = data.guests.filter((g) => !g.settled_at && g.lines.length > 0);
  const settledTotal = data.guests.reduce((sum, g) => sum + (g.settled_amount ?? 0), 0);
  const openGuest = data.guests.find((g) => g.key === openKey) ?? null;
  // 枠で絞り込むチップは、お客さんがいる枠と今日の枠だけ出す
  const filterSlots = slots.filter((s) => s.date === now.date || data.guests.some((g) => g.slot_id === s.id));

  return (
    <div className="space-y-4">
      {data.events.length > 1 ? (
        <select
          value={data.event.id}
          onChange={(e) => {
            setEventId(e.target.value);
            setSlotFilter("all");
          }}
          className="h-11 w-full rounded-md border bg-white px-3 font-semibold"
        >
          {data.events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.first_date.slice(5).replace("-", "/")} {ev.title}
            </option>
          ))}
        </select>
      ) : (
        <h2 className="text-lg font-semibold">{data.event.title}</h2>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
          <p className="text-xs text-amber-800">未精算</p>
          <p className="font-semibold tabular-nums">
            {unsettled.length}件 {formatYen(unsettled.reduce((sum, g) => sum + tabTotal(g.lines), 0))}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2">
          <p className="text-xs text-emerald-800">精算済み</p>
          <p className="font-semibold tabular-nums">{formatYen(settledTotal)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・予約コードで探す"
          className="h-11 bg-white pl-9"
        />
      </div>

      {filterSlots.length > 1 && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "all", label: "すべて" }, ...filterSlots.map((s) => ({
            id: s.id,
            label: slotLabel(s.date, s.start_time, s.end_time, multiDay),
          }))].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSlotFilter(chip.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                slotFilter === chip.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </nav>
      )}

      <Button variant="outline" className="h-11 w-full gap-1 bg-white" onClick={() => setWalkinOpen(true)}>
        <Plus className="h-4 w-4" />
        飛び込みのお客さんを追加
      </Button>

      <ul className="space-y-2">
        {guests.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">お客さんはいません</li>
        )}
        {guests.map((guest) => {
          const total = tabTotal(guest.lines);
          const settled = !!guest.settled_at;
          return (
            <li key={guest.key}>
              <button
                onClick={() => setOpenKey(guest.key)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left active:bg-zinc-100 ${
                  settled ? "border-emerald-200 bg-emerald-50" : total > 0 ? "border-amber-300 bg-white" : "bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{guest.guest_name}様</span>
                    {guest.guest_count && <span className="text-xs text-muted-foreground">{guest.guest_count}名</span>}
                    {!guest.reservation_id && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800">飛び込み</span>
                    )}
                    {guest.reservation_id && guest.payment_status !== "paid" && (guest.total_price ?? 0) > 0 && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px]">入場料 現地払い</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {guest.start_time && guest.end_time
                      ? slotLabel(guest.date ?? "", guest.start_time, guest.end_time, multiDay)
                      : "枠指定なし"}
                    {guest.lines.length > 0 ? ` / ${lineSummary(guest, data.items)}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {settled ? (
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <Check className="h-4 w-4" />
                      {formatYen(guest.settled_amount ?? 0)}
                    </span>
                  ) : total > 0 ? (
                    <span className="font-semibold tabular-nums">{formatYen(total)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">記録する</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <GuestTabDialog key={openGuest?.key ?? "none"} token={token} guest={openGuest} items={data.items} onClose={() => setOpenKey(null)} />
      <WalkinDialog
        open={walkinOpen}
        token={token}
        eventId={data.event.id}
        slots={slots}
        defaultSlotId={currentSlotId}
        onClose={() => setWalkinOpen(false)}
        onCreated={(tabId) => {
          setWalkinOpen(false);
          setOpenKey(`t:${tabId}`);
        }}
      />
    </div>
  );
};
