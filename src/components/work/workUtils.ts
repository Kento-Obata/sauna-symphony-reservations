import { differenceInCalendarDays } from "date-fns";

export type WorkCategory = "cleaning" | "maintenance" | "operation";

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  cleaning: "清掃",
  maintenance: "メンテナンス",
  operation: "営業",
};

export const CATEGORY_BADGE_CLASS: Record<WorkCategory, string> = {
  cleaning: "bg-sky-100 text-sky-800",
  maintenance: "bg-amber-100 text-amber-800",
  operation: "bg-zinc-100 text-zinc-700",
};

export const WORK_PHOTO_BUCKET = "work-photos";

/** 店舗(JST)基準の今日 yyyy-MM-dd */
export const todayJst = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

const jstDate = (iso: string) =>
  new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(iso)));

/** ISO 日時 → JST の "10:32" */
export const formatClock = (iso: string | null) => {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
};

/** ISO 日時 → JST の "10/30(金) 10:32" */
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

/** 最終実施からの経過日数（今日 = 0）。未実施は null */
export const daysSince = (iso: string | null) =>
  iso ? differenceInCalendarDays(jstDate(new Date().toISOString()), jstDate(iso)) : null;

export const formatLastWorked = (iso: string | null) => {
  const days = daysSince(iso);
  if (days === null) return "まだ記録なし";
  if (days === 0) return `今日 ${formatClock(iso)}`;
  if (days === 1) return "昨日";
  return `${days}日前`;
};

/** 頻度の目安を過ぎているか */
export const isOverdue = (frequencyDays: number | null, lastWorkedAt: string | null) => {
  if (!frequencyDays) return false;
  const days = daysSince(lastWorkedAt);
  return days === null || days >= frequencyDays;
};

export const formatFrequency = (days: number | null) => {
  if (!days) return null;
  if (days === 1) return "毎日";
  if (days % 30 === 0) return `${days / 30}か月ごと`;
  if (days % 7 === 0) return `${days / 7}週間ごと`;
  return `${days}日ごと`;
};

export const formatYen = (yen: number) => `¥${yen.toLocaleString()}`;

export const staffWorkUrl = (token: string) => `${window.location.origin}/my/${token}`;
