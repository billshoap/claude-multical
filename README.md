# MultiCal

Multi-account Google Calendar MCP connector for Claude — add any number of Google accounts and manage all your calendars.

## One-command Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/billshoap/claude-multical/main/install.sh)
```

Or with your Google credentials:
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/billshoap/claude-multical/main/install.sh) \
  --client-id YOUR_ID --client-secret YOUR_SECRET
```

Restart Claude → "Add my calendar account"

## Per-Machine Setup

Since tokens are stored **locally** on each machine (`~/.multical/accounts.json`), you must run the install and authorize each account **once per computer**:

| Machine | Steps |
|---|---|
| Desktop | Run install script → authorize in browser → done |
| Laptop | Run install script → authorize in browser → done |
| Work computer | Run install script → authorize in browser → done |

Authorizing on one machine does **not** grant access on another. Your tokens never leave the machine they were created on.

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
