import { isHoliday as isJpHoliday } from "japanese-holidays";
import { addDays, isAfter } from "date-fns";

export const isHoliday = (date: Date): boolean => {
  return !!isJpHoliday(date);
};

export const isWeekend = (date: Date): boolean => {
  const d = date.getDay();
  return d === 0 || d === 6;
};

export const isWeekendOrHoliday = (date: Date): boolean => {
  return isWeekend(date) || isHoliday(date);
};

/**
 * Enumerate all weekend/holiday dates in [start, end] (inclusive).
 */
export const enumerateWeekendsAndHolidays = (start: Date, end: Date): Date[] => {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (!isAfter(cur, last)) {
    if (isWeekendOrHoliday(cur)) out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
};
