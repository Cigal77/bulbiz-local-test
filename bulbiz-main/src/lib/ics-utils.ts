/**
 * Generate an .ics (iCalendar) file content for an appointment.
 */

interface IcsEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  uid?: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIcsDateTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.slice(0, 5).split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateIcsContent(event: IcsEvent): string {
  const uid = event.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@bulbiz.fr`;
  const dtStart = toIcsDateTime(event.startDate, event.startTime);
  const dtEnd = toIcsDateTime(event.startDate, event.endTime);
  const now = new Date();
  const dtStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bulbiz//RDV//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }

  lines.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(event.title)}`, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadIcsFile(event: IcsEvent, filename?: string) {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `rdv-${event.startDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarUrl(event: IcsEvent): string {
  const dtStart = toIcsDateTime(event.startDate, event.startTime);
  const dtEnd = toIcsDateTime(event.startDate, event.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${dtStart}/${dtEnd}`,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateOutlookCalendarUrl(event: IcsEvent): string {
  const startDt = `${event.startDate}T${event.startTime.slice(0, 5)}:00`;
  const endDt = `${event.startDate}T${event.endTime.slice(0, 5)}:00`;
  const params = new URLSearchParams({
    rru: "addevent",
    startdt: startDt,
    enddt: endDt,
    subject: event.title,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { body: event.description } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
