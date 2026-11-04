// 道具どうしで共通の定義(予約の状態・日付の範囲・予約コード)。

import { formatMdWithWeekday } from "../../date-jst.ts";
import { formatReservationTime } from "../../reservation-time.ts";
import { type JsonSchema, type Sql, ToolError } from "../types.ts";

/** 枠を押さえている予約(確定・メール確認待ち・決済待ち) */
export const ACTIVE_STATUSES = ["confirmed", "pending", "pending_payment"];

/** 管理カレンダーで枠を止めるための仮の予約の名前(お客様の予約ではない) */
export const BLOCK_NAME = "休枠";

export const STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  pending: "仮予約（お客様の確認待ち）",
  pending_payment: "事前決済の手続き中",
  cancelled: "キャンセル",
  expired: "失効",
};

export const dateSchema = (description: string): JsonSchema => ({ type: "string", format: "date", description });

export const reservationCodeSchema: JsonSchema = {
  type: "string",
  pattern: "^[A-Za-z0-9]{8}$",
  description: "予約コード(英数字8文字)",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** from〜to(両端を含む)の日数を確かめる。広すぎる範囲は AI の取り違えのことが多いので止める */
export const assertDateRange = (from: string, to: string, maxDays = 62) => {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;
  if (days < 1) throw new ToolError("終わりの日付が始まりの日付より前です");
  if (days > maxDays) throw new ToolError(`期間は${maxDays}日以内で指定してください`);
};

export interface ReservationRow {
  id: string;
  reservation_code: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  guest_name: string;
  guest_count: number;
  status: string;
}

/** 予約コードから予約を探す(呼び出した人の権限で)。無ければ ToolError */
export const findReservationByCode = async (tx: Sql, code: string): Promise<ReservationRow> => {
  const rows = await tx`
    select id::text, reservation_code, date::text, start_time::text, end_time::text, guest_name, guest_count, status
    from public.reservations
    where reservation_code = ${code.toUpperCase()}
    limit 1
  `;
  if (!rows[0]) throw new ToolError(`予約コード ${code.toUpperCase()} の予約が見つかりません`);
  return rows[0];
};

/** "11/5(木) 10:00-12:30 山田様 2名" */
export const reservationLabel = (r: Pick<ReservationRow, "date" | "start_time" | "end_time" | "guest_name" | "guest_count">) =>
  `${formatMdWithWeekday(r.date)} ${formatReservationTime(r)} ${r.guest_name}様 ${r.guest_count}名`.replace(/\s+/g, " ");
