export {};

/** Adds an alpha channel to a #rrggbb (or #rgb) hex color, e.g. withAlpha("#FDFBF6", .8). */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map(char => char + char).join("") : normalized;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

