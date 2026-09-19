/**
 * Format a date-time string as "DD/MM/YYYY, HH:MM:SS".
 * Uses a fixed locale (en-GB) and 24-hour clock so every record
 * shows its own distinct timestamp clearly regardless of browser locale.
 */
export const fmtDate = (s?: string): string => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");
