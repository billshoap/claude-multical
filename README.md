# MultiCal

Multi-account Google Calendar MCP connector for Claude — add any number of Google accounts and manage all your calendars.

## Requirements

A Google Cloud project with:
- **Google Calendar API** enabled
- **OAuth Desktop Client ID** with redirect URI `http://localhost`
- **Your email** added as a test user

Don't have a project? Use the MultiMail setup guide — both share the same credentials.

## Install

Run this on each computer you use Claude on:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/billshoap/claude-multical/main/install.sh)
```

The script will ask for your **Client ID** and **Client Secret** (one-time). Then restart Claude.

## First Use

1. Restart Claude Desktop
2. Say **"Add my calendar account"**
3. Browser opens → sign in → click **Allow**
4. Done. Say **"What's on my calendar today?"**

Repeat steps 2-4 for each computer. Tokens live locally on each machine.

## The Problem

The stock Google Calendar MCP connector only supports a single account. MultiCal lets you add unlimited accounts and switch between them seamlessly.

## Quick Start

### 1. Enable Google Calendar API

If you already have a Google Cloud project (e.g. from MultiMail), just enable the Calendar API:

- Go to https://console.cloud.google.com/apis/library
- Select your project (`multimail-498519`)
- Search "Google Calendar API" → **Enable**

### 2. Add to Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "MultiCal": {
      "command": "node",
      "args": ["/absolute/path/to/multical/build/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your_client_id",
        "GOOGLE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### 3. Restart Claude → say "Add my calendar account"

## Commands

| In Claude, say... | What happens |
|---|---|
| "Add my calendar account" | Browser opens → sign in → done |
| "What's on my calendar today?" | Lists today's events |
| "Create an event tomorrow at 2pm" | Creates a calendar event |
| "Show my calendars" | Lists all your calendars |
| "Am I free on Friday?" | Checks availability |
| "Add another calendar account" | Repeat for a second account |

## Custom Connectors

Bill Shoap builds custom MCP connectors for Claude. [wshoap@gmail.com](mailto:wshoap@gmail.com)
