import type { ReceiptSettings } from "../types";

/**
 * The number printed on the slip.
 *
 * It is the row number in the workbook, which makes it the honest one: the
 * fortieth person through the door holds token 0040, and that is exactly the
 * row an office clerk scrolls to. No separate counter to drift out of step.
 */
export function formatToken(r: ReceiptSettings, rowCount: number): string {
  if (!r.enabled || !r.showToken) return "";
  const n = Math.max(1, rowCount);
  return `${r.tokenPrefix}${String(n).padStart(4, "0")}`;
}
