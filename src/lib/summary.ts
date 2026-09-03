import { formatDateTimeInZone, formatInZone } from "./timezones";
import type { Person } from "./overlap";
import type { ProposedMeeting } from "./slots";

export function buildPlainSummary(
  people: Person[],
  dateISO: string,
  meeting: ProposedMeeting | null,
): string {
  const lines: string[] = [];
  lines.push("Overlap — proposed meeting");
  lines.push(`Date: ${dateISO}`);
  if (!meeting) {
    lines.push("No meeting selected.");
  } else {
    lines.push(
      `UTC: ${formatDateTimeInZone(meeting.startMs, "UTC")} – ${formatInZone(meeting.endMs, "UTC")} (${meeting.durationMin} min)`,
    );
    lines.push("");
    for (const p of people) {
      const label = p.name.trim() || "Unnamed";
      const start = formatDateTimeInZone(meeting.startMs, p.timeZone);
      const end = formatInZone(meeting.endMs, p.timeZone);
      lines.push(`${label} (${p.timeZone}): ${start} – ${end}`);
    }
  }
  return lines.join("\n");
}

export function buildMarkdownSummary(
  people: Person[],
  dateISO: string,
  meeting: ProposedMeeting | null,
): string {
  const lines: string[] = [];
  lines.push("## Overlap — proposed meeting");
  lines.push("");
  lines.push(`- **Date:** ${dateISO}`);
  if (!meeting) {
    lines.push("- **Status:** no meeting selected");
    return lines.join("\n");
  }
  lines.push(
    `- **UTC:** ${formatDateTimeInZone(meeting.startMs, "UTC")} – ${formatInZone(meeting.endMs, "UTC")}`,
  );
  lines.push(`- **Duration:** ${meeting.durationMin} minutes`);
  lines.push("");
  lines.push("| Person | Timezone | Local start | Local end |");
  lines.push("| --- | --- | --- | --- |");
  for (const p of people) {
    const label = p.name.trim() || "_Unnamed_";
    const start = formatDateTimeInZone(meeting.startMs, p.timeZone);
    const end = formatInZone(meeting.endMs, p.timeZone);
    lines.push(`| ${escapeMd(label)} | \`${p.timeZone}\` | ${start} | ${end} |`);
  }
  return lines.join("\n");
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|");
}
