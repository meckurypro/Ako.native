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
async function resolveWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      return defaultCalendar?.id ?? null;
    } catch {
      return null;
    }
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find(cal => cal.allowsModifications) ?? calendars[0];
  return writable?.id ?? null;
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

  const calendarId = await resolveWritableCalendarId();
  if (!calendarId) return false;

  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + (event.durationHours ?? 2) * 60 * 60 * 1000);

  try {
    await Calendar.createEventAsync(calendarId, {
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
