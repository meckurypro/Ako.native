// File: lib/deviceCalendar.ts
//
// Adds an event straight to the device's own calendar app via expo-calendar,
// now that the calendar permission flow (lib/permissions.ts) is wired up.
// Previously the only "Add to calendar" option on native was a Google
// Calendar web link (see the calendarUrl() fallback still kept in
// app/projects/[projectId].tsx) — that still works if the user declines the
// permission or the OS blocks it, but the primary path now writes directly
// into Calendar.app / the Android calendar provider, matching what a native
// app should do.
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";
import { ensurePermission } from "./permissions";

export type DeviceCalendarEvent = {
  title: string;
  description?: string | null;
  location?: string;
  startIso: string;
  durationHours?: number; // default 2, matches web's src/lib/calendar.ts
};

// iOS exposes a single "default calendar" directly. Android has no such
// concept — we have to list calendars and pick a writable one ourselves.
// expo-calendar SDK 57 moved to an object API: the old *Async helpers
// (getDefaultCalendarAsync, getCalendarsAsync, createEventAsync) are kept only as
// stubs that throw, so this uses ExpoCalendar instances and calendar.createEvent().
async function resolveWritableCalendar(): Promise<Calendar.ExpoCalendar | null> {
  if (Platform.OS === "ios") {
    try {
      return Calendar.getDefaultCalendarSync();
    } catch {
      return null;
    }
  }
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter(cal => cal.allowsModifications);
  return writable.find(cal => cal.isPrimary) ?? writable[0] ?? null;
}

/**
 * Requests calendar permission (via the shared rationale/blocked flow) and,
 * if granted, writes the event to a real device calendar. Returns false
 * (without throwing) on a declined/blocked permission, a device with no
 * writable calendar, or any calendar-provider error — callers should fall
 * back to calendarUrl()/openUrl() in that case, same as before this existed.
 */
export async function addEventToDeviceCalendar(event: DeviceCalendarEvent): Promise<boolean> {
  const granted = await ensurePermission("calendar");
  if (!granted) return false;

  const calendar = await resolveWritableCalendar().catch(() => null);
  if (!calendar) return false;

  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + (event.durationHours ?? 2) * 60 * 60 * 1000);

  try {
    await calendar.createEvent({
      title: event.title,
      notes: event.description ?? undefined,
      location: event.location,
      startDate: start,
      endDate: end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return true;
  } catch {
    return false;
  }
}
