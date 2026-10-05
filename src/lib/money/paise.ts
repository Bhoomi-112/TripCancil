/**
 * Money is integer paise, always. Rupees only exist on screen, and they are
 * parsed out of text by hand rather than by `parseFloat`, because 0.1 + 0.2 has
 * no place in a trip ledger.
 */

/** ₹1,23,456.78 — Indian digit grouping, because that is where this runs. */
export function formatPaise(paise: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  const negative = paise < 0;
  const absolute = Math.abs(Math.round(paise));

  const rupees = Math.floor(absolute / 100);
  const change = absolute % 100;
  const grouped = String(rupees).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}${symbol}${grouped}.${String(change).padStart(2, "0")}`;
}

/** Compact form for tight spots: "₹1,234" and "₹4.2k". */
export function formatPaiseShort(paise: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  const absolute = Math.abs(paise);
  const rupees = absolute / 100;
  const sign = paise < 0 ? "-" : "";

  if (rupees >= 10000) return `${sign}${symbol}${(rupees / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${Math.round(rupees).toLocaleString("en-IN")}`;
}

/**
 * Reads what someone typed into paise. Returns null rather than a guess, so a
 * half-typed amount becomes a field error rather than a wrong expense.
 *
 * Accepts "1,200", "1200.5", "₹ 99", "1,20,000.75".
 */
export function parsePaise(input: string): number | null {
  const cleaned = input
    .replace(/[₹,\s]/g, "")
    .replace(/^rupees?/i, "")
    .trim();

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [rupees, change = ""] = cleaned.split(".");
  const paise = Number(rupees) * 100 + Number(change.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

/** Sums that must add up, with the remainder landing on the first members. */
export function splitEqually(amountPaise: number, memberIds: string[]): Map<string, number> {
  const shares = new Map<string, number>();
  const ids = [...memberIds].sort();
  if (ids.length === 0 || amountPaise <= 0) return shares;

  const each = Math.floor(amountPaise / ids.length);
  let remainder = amountPaise - each * ids.length;

  for (const id of ids) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    shares.set(id, each + extra);
  }
  return shares;
}

/** "₹412 of ₹1,240 · 4 ways" style detail for an expense row. */
export function describeSplit(
  amountPaise: number,
  shares: Map<string, number>,
  names: Map<string, string>,
): string {
  const entries = [...shares.entries()];
  if (entries.length === 0) return "Split between nobody";

  const each = new Set(entries.map(([, share]) => share)).size === 1;
  if (each) {
    const one = entries[0][1];
    return `${entries.length} ways · ${formatPaise(one)} each`;
  }

  const biggest = Math.max(...entries.map(([, share]) => share));
  const who = names.get(entries.find(([, share]) => share === biggest)?.[0] ?? "");
  return `${entries.length} ways · ${formatPaise(biggest)} for ${who ?? "someone"}`;
}