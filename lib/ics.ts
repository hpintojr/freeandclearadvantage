import { siteConfig } from "@/lib/config";

/**
 * Minimal RFC 5545 generator for the post-booking confirmation download.
 *
 * Deliberately carries no sensitive lead data — no DOB, debt amount, debt
 * types, address, or IP. Only the appointment itself and the callback number.
 */

export const icsFileName = "free-clear-advantage-consultation.ics";

/** Escape per RFC 5545 §3.3.11 (TEXT). Backslash first so it is not doubled. */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines to 75 octets per RFC 5545 §3.1, continuing with a space. */
function foldLine(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never split a multi-byte UTF-8 character across a fold boundary.
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    limit = 74; // continuation lines lose one octet to the leading space
  }
  return parts.join("\r\n ");
}

/** Format as a UTC iCalendar timestamp: 20260813T173000Z */
function toIcsUtc(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export type IcsEvent = {
  bookingId: string;
  startTime: string;
  endTime: string;
  /** Injected by callers so the output is deterministic in tests. */
  stamp?: Date;
};

export function buildConsultationIcs({ bookingId, startTime, endTime, stamp }: IcsEvent) {
  const description = [
    "Your Free & Clear Advantage telephone consultation is confirmed.",
    "A specialist will call you at the number you provided.",
    `If you need to reach us, call ${siteConfig.callPhone}.`,
  ].join(" ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Free & Clear Advantage//Consultation Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(bookingId)}@freeandclearadvantage.com`,
    `DTSTAMP:${toIcsUtc(stamp || new Date())}`,
    `DTSTART:${toIcsUtc(startTime)}`,
    `DTEND:${toIcsUtc(endTime)}`,
    `SUMMARY:${escapeText("Free & Clear Advantage Telephone Consultation")}`,
    `LOCATION:${escapeText("Telephone call")}`,
    `DESCRIPTION:${escapeText(description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("Free & Clear Advantage consultation in 1 hour")}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF line endings are required; Apple Calendar rejects bare LF files.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
