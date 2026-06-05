#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import open from "open";
import { getAccounts, getAccount, removeAccount } from "./store.js";
import { initiateOAuth, getAuthenticatedClient } from "./auth.js";
import { updateTokens } from "./store.js";
import {
  CalendarInfo, CalendarEvent,
  ListEventsParams, CreateEventParams, UpdateEventParams, FreeBusyParams,
} from "./types.js";

const server = new Server(
  {
    name: "MultiCal",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

function getCalendar(account: { accessToken: string; refreshToken: string; expiryDate: number }) {
  const auth = getAuthenticatedClient(account);
  return google.calendar({ version: "v3", auth });
}

async function ensureFreshToken(account: { email: string; accessToken: string; refreshToken: string; expiryDate: number }): Promise<void> {
  const auth = getAuthenticatedClient(account);
  const now = Date.now();
  if (account.expiryDate && account.expiryDate <= now + 60_000) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      await updateTokens(
        account.email,
        credentials.access_token!,
        credentials.refresh_token || account.refreshToken,
        credentials.expiry_date ?? now + 3600_000
      );
    } catch (err) {
      throw new Error(`Token refresh failed for ${account.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}

async function getOrCreatePrimaryCalendar(account: { accessToken: string; refreshToken: string; expiryDate: number }): Promise<string> {
  const cal = getCalendar(account);
  const res = await cal.calendarList.list();
  const primary = res.data.items?.find((c: any) => c.primary);
  return primary?.id ?? "primary";
}

function formatEvent(e: any): CalendarEvent {
  return {
    id: e.id,
    summary: e.summary || "(no title)",
    description: e.description,
    location: e.location,
    start: e.start,
    end: e.end,
    attendees: e.attendees?.map((a: any) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
    })),
    organizer: e.organizer ? { email: e.organizer.email, displayName: e.organizer.displayName } : undefined,
    status: e.status,
    htmlLink: e.htmlLink,
    recurringEventId: e.recurringEventId,
    reminders: e.reminders,
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add_calendar_account",
      description: "Add a new Google Calendar account by opening a browser for Google OAuth authorization",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_calendar_accounts",
      description: "List all configured Google Calendar accounts",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "remove_calendar_account",
      description: "Remove a configured Google Calendar account",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account to remove" },
        },
        required: ["accountId"],
      },
    },
    {
      name: "list_calendars",
      description: "List all calendars for a Google account (primary, secondary, shared)",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
        },
        required: ["accountId"],
      },
    },
    {
      name: "list_events",
      description: "List upcoming events from a calendar",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
          calendarId: { type: "string", description: "Calendar ID (defaults to primary calendar)" },
          timeMin: { type: "string", description: "Start time (ISO 8601, defaults to now)" },
          timeMax: { type: "string", description: "End time (ISO 8601)" },
          maxResults: { type: "number", description: "Maximum events to return (default: 20)" },
          query: { type: "string", description: "Free text search in events" },
          singleEvents: { type: "boolean", description: "Expand recurring events into instances (default: true)" },
          orderBy: { type: "string", description: "Sort order: 'startTime' or 'updated' (default: startTime)" },
        },
        required: ["accountId"],
      },
    },
    {
      name: "create_event",
      description: "Create a new calendar event",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
          calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
          summary: { type: "string", description: "Event title" },
          description: { type: "string", description: "Event description" },
          location: { type: "string", description: "Event location" },
          start: {
            type: "object",
            description: "Start time: { dateTime: '2026-06-05T14:00:00', timeZone: 'America/New_York' } or { date: '2026-06-05' } for all-day",
            properties: {
              dateTime: { type: "string" },
              date: { type: "string" },
              timeZone: { type: "string" },
            },
          },
          end: {
            type: "object",
            description: "End time: same format as start",
            properties: {
              dateTime: { type: "string" },
              date: { type: "string" },
              timeZone: { type: "string" },
            },
          },
          attendees: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string" },
                displayName: { type: "string" },
              },
              required: ["email"],
            },
          },
        },
        required: ["accountId", "summary", "start", "end"],
      },
    },
    {
      name: "update_event",
      description: "Update an existing calendar event",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
          eventId: { type: "string", description: "The event ID to update" },
          calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
          summary: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          start: {
            type: "object",
            properties: {
              dateTime: { type: "string" },
              date: { type: "string" },
              timeZone: { type: "string" },
            },
          },
          end: {
            type: "object",
            properties: {
              dateTime: { type: "string" },
              date: { type: "string" },
              timeZone: { type: "string" },
            },
          },
          attendees: {
            type: "array",
            items: {
              type: "object",
              properties: { email: { type: "string" }, displayName: { type: "string" } },
              required: ["email"],
            },
          },
        },
        required: ["accountId", "eventId"],
      },
    },
    {
      name: "delete_event",
      description: "Delete a calendar event",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
          eventId: { type: "string", description: "The event ID to delete" },
          calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
        },
        required: ["accountId", "eventId"],
      },
    },
    {
      name: "get_free_busy",
      description: "Check availability across calendars for a time period",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Email address of the account" },
          timeMin: { type: "string", description: "Start of time range (ISO 8601)" },
          timeMax: { type: "string", description: "End of time range (ISO 8601)" },
          calendarIds: {
            type: "array",
            items: { type: "string" },
            description: "Specific calendars to check (defaults to primary only)",
          },
        },
        required: ["accountId", "timeMin", "timeMax"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "add_calendar_account": {
      try {
        const { url, email: emailPromise } = await initiateOAuth();
        setImmediate(async () => { try { await open(url); } catch { /* URL fallback */ } });
        const email = await emailPromise;
        return { content: [{ type: "text", text: `✅ Successfully authorized Google Calendar account: **${email}**\n\nYou can now manage your calendars from Claude.` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { content: [{ type: "text", text: `❌ Authorization failed: ${msg}` }], isError: true };
      }
    }

    case "list_calendar_accounts": {
      const accounts = await getAccounts();
      const emails = Object.keys(accounts);
      if (emails.length === 0) {
        return { content: [{ type: "text", text: "No Calendar accounts configured. Use `add_calendar_account` to add one." }] };
      }
      return { content: [{ type: "text", text: `**Configured accounts (${emails.length}):**\n${emails.map((e) => `- ${e}`).join("\n")}` }] };
    }

    case "remove_calendar_account": {
      const { accountId } = args as { accountId: string };
      const removed = await removeAccount(accountId);
      if (!removed) return { content: [{ type: "text", text: `Account not found: ${accountId}` }], isError: true };
      return { content: [{ type: "text", text: `✅ Removed account: ${accountId}` }] };
    }

    case "list_calendars": {
      const { accountId } = args as { accountId: string };
      const account = await getAccount(accountId);
      if (!account) throw new Error(`Account not found: ${accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);
      const res = await cal.calendarList.list();
      const items: CalendarInfo[] = (res.data.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summary,
        description: c.description,
        timeZone: c.timeZone,
        colorId: c.colorId,
        backgroundColor: c.backgroundColor,
        foregroundColor: c.foregroundColor,
        accessRole: c.accessRole,
        primary: c.primary || false,
      }));

      const formatted = items.map((c) =>
        `${c.primary ? "⭐" : "📅"} **${c.summary}** (${c.accessRole})\n  ID: \`${c.id}\`${c.timeZone ? ` | TZ: ${c.timeZone}` : ""}`
      );

      return { content: [{ type: "text", text: `**Calendars for ${accountId}** (${items.length}):\n\n${formatted.join("\n\n")}` }] };
    }

    case "list_events": {
      const params = args as unknown as ListEventsParams;
      const account = await getAccount(params.accountId);
      if (!account) throw new Error(`Account not found: ${params.accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);

      const calendarId = params.calendarId || await getOrCreatePrimaryCalendar(account);
      const res = await cal.events.list({
        calendarId,
        timeMin: params.timeMin || new Date().toISOString(),
        timeMax: params.timeMax,
        maxResults: params.maxResults || 20,
        q: params.query,
        singleEvents: params.singleEvents ?? true,
        orderBy: params.orderBy || "startTime",
      });

      const events = (res.data.items || []).map(formatEvent);

      if (events.length === 0) {
        return { content: [{ type: "text", text: "No events found." }] };
      }

      const formatted = events.map((e) => {
        const startStr = e.start.dateTime || e.start.date || "(no date)";
        return `📌 **${e.summary}**\n  When: ${startStr}\n  Status: ${e.status}\n  ID: \`${e.id}\`${e.location ? `\n  Location: ${e.location}` : ""}`;
      });

      return { content: [{ type: "text", text: `**Events** (${events.length}):\n\n${formatted.join("\n\n")}` }] };
    }

    case "create_event": {
      const params = args as unknown as CreateEventParams;
      const account = await getAccount(params.accountId);
      if (!account) throw new Error(`Account not found: ${params.accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);

      const calendarId = params.calendarId || await getOrCreatePrimaryCalendar(account);
      const res = await cal.events.insert({
        calendarId,
        requestBody: {
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: params.start as any,
          end: params.end as any,
          attendees: params.attendees,
          reminders: params.reminders ? { useDefault: params.reminders.useDefault ?? false, overrides: params.reminders.overrides } : undefined,
        },
      });

      const event = formatEvent(res.data);
      const startStr = event.start.dateTime || event.start.date || "";
      return { content: [{ type: "text", text: `✅ Event created: **${event.summary}**\nWhen: ${startStr}\nLink: ${event.htmlLink}\nID: \`${event.id}\`` }] };
    }

    case "update_event": {
      const params = args as unknown as UpdateEventParams;
      const account = await getAccount(params.accountId);
      if (!account) throw new Error(`Account not found: ${params.accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);

      const calendarId = params.calendarId || await getOrCreatePrimaryCalendar(account);
      const body: Record<string, any> = {};
      if (params.summary !== undefined) body.summary = params.summary;
      if (params.description !== undefined) body.description = params.description;
      if (params.location !== undefined) body.location = params.location;
      if (params.start !== undefined) body.start = params.start;
      if (params.end !== undefined) body.end = params.end;
      if (params.attendees !== undefined) body.attendees = params.attendees;

      const res = await cal.events.patch({
        calendarId,
        eventId: params.eventId,
        requestBody: body,
      });

      const event = formatEvent(res.data);
      return { content: [{ type: "text", text: `✅ Event updated: **${event.summary}**\nID: \`${event.id}\`` }] };
    }

    case "delete_event": {
      const { accountId, eventId, calendarId } = args as { accountId: string; eventId: string; calendarId?: string };
      const account = await getAccount(accountId);
      if (!account) throw new Error(`Account not found: ${accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);

      const calId = calendarId || await getOrCreatePrimaryCalendar(account);
      await cal.events.delete({ calendarId: calId, eventId });

      return { content: [{ type: "text", text: `✅ Event deleted: \`${eventId}\`` }] };
    }

    case "get_free_busy": {
      const params = args as unknown as FreeBusyParams;
      const account = await getAccount(params.accountId);
      if (!account) throw new Error(`Account not found: ${params.accountId}`);
      await ensureFreshToken(account);
      const cal = getCalendar(account);

      const calendarIds = params.calendarIds || ["primary"];
      const res = await cal.freebusy.query({
        requestBody: {
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          items: calendarIds.map((id) => ({ id })),
        },
      });

      const calendars = res.data.calendars || {};
      const results = Object.entries(calendars).map(([cid, data]: [string, any]) => ({
        calendarId: cid,
        busy: (data.busy || []).map((b: any) => ({ start: b.start, end: b.end })),
      }));

      const formatted = results.map((r) => {
        if (r.busy.length === 0) return `📅 Calendar \`${r.calendarId}\`: **Free** all day`;
        const times = r.busy.map((b: { start: string; end: string }) => `  - ${b.start} → ${b.end}`).join("\n");
        return `📅 Calendar \`${r.calendarId}\` (${r.busy.length} busy slots):\n${times}`;
      });

      return { content: [{ type: "text", text: `**Free/Busy for ${params.accountId}:**\n\n${formatted.join("\n\n")}` }] };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const accounts = await getAccounts();
  const resources = [];

  for (const email of Object.keys(accounts)) {
    resources.push({
      uri: `calendar://${email}/events`,
      name: `Upcoming events for ${email}`,
      description: `Upcoming calendar events for ${email}`,
      mimeType: "text/plain",
    });
    resources.push({
      uri: `calendar://${email}/calendars`,
      name: `Calendar list for ${email}`,
      description: `All calendars for ${email}`,
      mimeType: "text/plain",
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const eventsMatch = uri.match(/^calendar:\/\/([^/]+)\/events$/);
  const calendarsMatch = uri.match(/^calendar:\/\/([^/]+)\/calendars$/);

  if (!eventsMatch && !calendarsMatch) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid URI: ${uri}`);
  }

  const email = decodeURIComponent((eventsMatch || calendarsMatch)![1]);
  const account = await getAccount(email);
  if (!account) throw new McpError(ErrorCode.InvalidRequest, `Account not found: ${email}`);

  await ensureFreshToken(account);
  const cal = getCalendar(account);

  if (calendarsMatch) {
    const res = await cal.calendarList.list();
    const items = (res.data.items || []).map((c: any) =>
      `${c.primary ? "⭐" : "📅"} ${c.summary} (${c.accessRole}) — TZ: ${c.timeZone || "UTC"}`
    );
    return { contents: [{ uri, mimeType: "text/plain", text: items.join("\n") || "No calendars found." }] };
  }

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  const text = (res.data.items || [])
    .map((e: any) => {
      const start = e.start?.dateTime || e.start?.date || "(no date)";
      return `${e.summary || "(no title)"} — ${start}`;
    })
    .join("\n");

  return { contents: [{ uri, mimeType: "text/plain", text: text || "No upcoming events." }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MultiCal MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
