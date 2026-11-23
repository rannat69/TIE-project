/** Convert ISO string to value for `<input type="datetime-local" />` (local timezone). */
export function isoToDatetimeLocalValue(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse `datetime-local` value to ISO, or null if empty/invalid. */
export function datetimeLocalValueToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatMeetingProposed(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Label for meeting `<select>` / lists: prefer proposed time when set. */
export function formatMeetingOptionLabel(m: {
  sequence: number;
  createdAt: string;
  status: string;
  proposedAt?: string | null;
}): string {
  const proposed = formatMeetingProposed(m.proposedAt ?? null);
  if (proposed) return `Meeting #${m.sequence} · ${proposed} · ${m.status}`;
  return `Meeting #${m.sequence} · created ${new Date(m.createdAt).toLocaleDateString()} · ${m.status}`;
}
