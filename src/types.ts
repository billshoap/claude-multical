export interface CalendarAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  scope: string;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: string;
  primary: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
  status: string;
  htmlLink?: string;
  recurringEventId?: string;
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
}

export interface ListEventsParams {
  accountId: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
  singleEvents?: boolean;
  orderBy?: string;
}

export interface CreateEventParams {
  accountId: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  attendees?: { email: string; displayName?: string }[];
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
}

export interface UpdateEventParams {
  accountId: string;
  eventId: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime: string; timeZone?: string } | { date: string };
  end?: { dateTime: string; timeZone?: string } | { date: string };
  attendees?: { email: string; displayName?: string }[];
}

export interface FreeBusyParams {
  accountId: string;
  timeMin: string;
  timeMax: string;
  calendarIds?: string[];
}

export interface FreeBusyResult {
  calendarId: string;
  busy: { start: string; end: string }[];
}
