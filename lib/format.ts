import { format, formatDistanceToNow } from "date-fns";

export function money(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const formatted = rounded.toLocaleString("en-PK", {
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  });
  return `Rs. ${formatted}`;
}

export function plainNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-PK", {
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  });
}

export function dateTime(ts: number): string {
  return format(ts, "d MMM yyyy, h:mm a");
}

export function relativeTime(ts: number): string {
  return formatDistanceToNow(ts, { addSuffix: true });
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}
