// File: lib/formatStats.ts
//
// Formatting helpers for the stats line shown under an expanded post
// (time · date · views), styled to match X's own post-detail formatting.
//
// formatPostTime / formatPostDate are identical to web. formatCompactCount
// is hand-rolled instead of using Intl.NumberFormat({ notation: "compact" })
// as web does — Hermes' Intl coverage for compact notation isn't something
// to lean on across every device, and this is a display string that has to
// come out the same everywhere. Output matches web's for whole-number
// counts: "304", "1.2K", "32.7K", "1M".

// 3-letter month abbreviations, except September — X abbreviates that one
// as "Sept" (4 letters) rather than "Sep", so this matches that quirk
// rather than a plain toLocaleDateString month format.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

/** "22:45" — 24-hour, local time. */
export function formatPostTime(dateString: string): string {
  const d = new Date(dateString);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "04 Sept 26" — day, month, 2-digit year. */
export function formatPostDate(dateString: string): string {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

const COMPACT_UNITS = [
  { value: 1e3, suffix: "K" },
  { value: 1e6, suffix: "M" },
  { value: 1e9, suffix: "B" },
  { value: 1e12, suffix: "T" },
];

// One decimal place at most, trailing ".0" dropped (1.0 → "1").
function roundOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "32.7K" / "1.2M" / "304" — compact notation, same shape as X's view counts. */
export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n)) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}${roundOneDecimal(abs)}`;

  // Largest unit that fits.
  let idx = 0;
  for (let i = COMPACT_UNITS.length - 1; i >= 0; i--) {
    if (abs >= COMPACT_UNITS[i].value) {
      idx = i;
      break;
    }
  }

  let scaled = roundOneDecimal(abs / COMPACT_UNITS[idx].value);
  // 999,950 rounds up to "1000K" at this unit — promote to "1M" instead.
  if (scaled >= 1000 && idx < COMPACT_UNITS.length - 1) {
    idx += 1;
    scaled = roundOneDecimal(abs / COMPACT_UNITS[idx].value);
  }

  return `${sign}${scaled}${COMPACT_UNITS[idx].suffix}`;
}
