import { describe, it, expect } from "vitest";
import { getAvailableTimeSlotsForDate } from "./availabilityUtils";
import type { Reservation, ShopClosure } from "@/types/reservation";

// 関数が参照するのは date / time_slot / status のみ。最小オブジェクトを組んでキャストする。
const resv = (date: string, slot: string, status = "confirmed"): Reservation =>
  ({ date, time_slot: slot, status } as unknown as Reservation);

const closure = (date: string): ShopClosure => ({ date } as unknown as ShopClosure);

describe("getAvailableTimeSlotsForDate（占有・定休の反映）", () => {
  it("平日8/1以降: 午前おやすみ。午後が予約済みなら残りは夕方・夜", () => {
    const date = new Date(2026, 7, 3); // 2026-08-03 月
    const reservations = [resv("2026-08-03", "afternoon")];
    expect(getAvailableTimeSlotsForDate(date, reservations, [], [])).toEqual([
      "evening",
      "night",
    ]);
  });

  it("平日8/1以降: 予約が無ければ午後・夕方・夜が空き（午前は出ない）", () => {
    const date = new Date(2026, 7, 3);
    expect(getAvailableTimeSlotsForDate(date, [], [], [])).toEqual([
      "afternoon",
      "evening",
      "night",
    ]);
  });

  it("定休日は空き無し（[]）", () => {
    const date = new Date(2026, 7, 3);
    expect(
      getAvailableTimeSlotsForDate(date, [], [closure("2026-08-03")], []),
    ).toEqual([]);
  });

  it("土曜: 夜が予約済みなら午前・午後・夕方が空き", () => {
    const date = new Date(2026, 7, 8); // 2026-08-08 土
    const reservations = [resv("2026-08-08", "night", "pending")];
    expect(getAvailableTimeSlotsForDate(date, reservations, [], [])).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("キャンセル済み(status=cancelled)は占有扱いしない", () => {
    const date = new Date(2026, 7, 3);
    const reservations = [resv("2026-08-03", "afternoon", "cancelled")];
    expect(getAvailableTimeSlotsForDate(date, reservations, [], [])).toEqual([
      "afternoon",
      "evening",
      "night",
    ]);
  });
});
