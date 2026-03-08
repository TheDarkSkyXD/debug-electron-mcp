# Debug Electron MCP

[![npm version](https://img.shields.io/npm/v/@debugelectron/debug-electron-mcp)](https://www.npmjs.com/package/@debugelectron/debug-electron-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)

**The ultimate Model Context Protocol (MCP) server for automating, debugging, and testing Electron applications.**

Use the power of AI to interact with ANY Electron application. Inspect the DOM, click buttons by text, fill forms, capture screenshots, and read console logs—all through a standardized protocol compatible with Claude Code, Claude Desktop, Cursor, and other MCP clients.

Install it once globally — it auto-detects which project you're in and scopes itself. Works with multiple Electron apps across multiple sessions with zero extra config.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [How Multi-Project Works](#how-multi-project-works)
- [Enabling Remote Debugging (Required)](#enabling-remote-debugging-required)
- [Usage Guide](#usage-guide)
  - [Core Workflow](#core-workflow)
  - [Tool Reference](#tool-reference)
  - [Project Management Tools](#project-management-tools)
  - [Interaction Commands](#interaction-commands)
- [Advanced: HTTP Server Mode](#advanced-http-server-mode)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Universal Compatibility
- **Works with ANY Electron app**: No source code modifications required.
- **Zero-setup integration**: Connects purely via Chrome DevTools Protocol (CDP).
- **Cross-platform**: Supports Windows, macOS, and Linux.

### Auto-Detect & Multi-Project
- **Automatic project detection**: Reads your `package.json` name or folder name — each project gets its own port automatically.
- **No config per project**: Install the MCP once globally. Open Claude Code in any Electron project and it just works.
- **Multiple apps, no conflicts**: App A on port 9222, App B on port 9223 — each Claude Code session only talks to its own app.
- **Shared registry on disk**: `~/.debug-electron-mcp.json` persists port assignments across sessions and restarts.

### Smart UI Automation
- **Semantic Interaction**: specific `click_by_text` and `fill_input` commands that "just work."
- **Visual Intelligence**: Take screenshots of specific windows to verify state.
- **Robust Actions**: Advanced `drag`, `hover`, `type`, and `wait` commands for complex workflows.

### Deep Observability
- **DOM Inspection**: `get_page_structure` gives AI a clean copy of the interactive operational map.
- **Log Streaming**: Read main process, renderer, and console logs in real-time.
- **Performance**: Monitor memory, timing, and system metrics.

---

## Quick Start

### Step 1: Add to your MCP config (one time)

#### Claude Code (Global — recommended)

Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

Done. Every Claude Code session now has the Electron tools available.

#### VS Code / Cursor

```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

#### Claude Desktop

```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "command": "npx",
      "args": ["-y", "@debugelectron/debug-electron-mcp@latest"]
    }
  }
}
```

### Step 2: Start your Electron app with remote debugging

The first time you use the MCP in a project, it auto-registers the project and assigns a port. Check `list_projects()` to see your assigned port, then start your app:

```bash
electron . --remote-debugging-port=9222
```

That's it. The MCP auto-detects your project and scopes all commands to it.

---

## How Multi-Project Works

The MCP automatically detects which project it's running in — no flags, no `projectName` in every call, no per-project config.

### What happens when Claude Code opens in your project:

1. Claude Code spawns the MCP server from your project directory
2. The MCP reads your `package.json` name (or uses the folder name)
3. If the project is already registered, it uses the existing port
4. If it's new, it auto-registers and assigns the next free port
5. All tool calls are automatically scoped to that project's port

### Example: Two apps, two sessions

```
# Session A: Claude Code in ~/projects/music-app/
# MCP auto-detects "music-app" → port 9222
take_screenshot()  # only sees music-app

# Session B: Claude Code in ~/projects/todo-app/
# MCP auto-detects "todo-app" → port 9223
take_screenshot()  # only sees todo-app
```

No cross-talk. No manual setup. Each session knows its app.

### Check your assigned port

Use `list_projects()` from any session to see all registered projects and their ports:

```
list_projects()
# -> Registered projects (2):
#    - music-app: port 9222 [connected (1 window(s))]
#    - todo-app: port 9223 [not connected]
```

### Registry persistence

Port assignments are saved to `~/.debug-electron-mcp.json` and shared across all sessions:

```json
{
  "portRange": [9222, 9322],
  "projects": {
    "music-app": { "port": 9222 },
    "todo-app": { "port": 9223 }
  }
}
```

### Manual project management

You can also manage projects explicitly with the built-in tools:

```
register_project({ projectName: "my-app" })                    # register with auto-assigned port
register_project({ projectName: "my-app", port: 9250 })        # register with specific port
unregister_project({ projectName: "old-app" })                  # free a port
list_projects()                                                  # see all projects
```

### Override with projectName

If you need to target a different project from the current session, pass `projectName` explicitly:
```
take_screenshot({ projectName: "other-app" })
```

---

## Enabling Remote Debugging (Required)

Your Electron app **must be running with remote debugging enabled** on the port assigned to your project.

Use `list_projects()` to check your assigned port, then start your app with that port.

### Method 1: Command Line Flag (Easiest)
```bash
electron . --remote-debugging-port=9222
```

### Method 2: package.json (Persistent)
```json
"scripts": {
  "start": "electron .",
  "dev:debug": "electron . --remote-debugging-port=9222"
}
```
Then run `npm run dev:debug`.

### Method 3: Programmatic (Best for Codebase)
```javascript
const { app } = require('electron');

if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
  const port = process.env.DEBUG_PORT || '9222';
  app.commandLine.appendSwitch('remote-debugging-port', port);
  console.log(`Remote debugging enabled on port ${port}`);
}
```

### Verification
Open `http://localhost:<port>/json` in your browser. If you see a JSON list of targets, you are ready.

---

## Usage Guide

### Core Workflow

1.  **Inspect**: Use `get_page_structure` to see what buttons and inputs are available.
2.  **Target**: Identify the element you want (e.g., a button with text "Login").
3.  **Act**: Send a command like `click_by_text` or `fill_input`.
4.  **Verify**: Use `take_screenshot` or `get_title` to confirm the action succeeded.

### Tool Reference

| Tool | Description |
|------|-------------|
| `get_electron_window_info` | Lists all open windows, their titles, and connection IDs. |
| `list_electron_windows` | Lists all available window targets across applications. |
| `take_screenshot` | Captures a screenshot of a specific window or the active one. |
| `read_electron_logs` | Streams console logs from the app (great for debugging errors). |
| **`send_command_to_electron`** | **The main tool.** Executes specific actions inside the app. |

### Project Management Tools

| Tool | Description |
|------|-------------|
| `register_project` | Register a project name, auto-assigns a debugging port. |
| `unregister_project` | Remove a project, free its port. |
| `list_projects` | Show all registered projects with ports and connection status. |

### Interaction Commands

Use these inside `send_command_to_electron`:

#### Clicking & Selection
| Command | Description |
|---------|-------------|
| **`click_by_text`** | *Best for buttons/links.* Usage: `{"text": "Submit"}` |
| **`click_by_selector`** | *Precise control.* Usage: `{"selector": ".submit-btn"}` |
| **`click_button`** | *Legacy click command.* Usage: `{"selector": "#btn"}` |
| **`select_option`** | *For dropdowns.* Usage: `{"text": "Category", "value": "Books"}` |
| **`hover`** | *Hover over elements.* Usage: `{"selector": ".tooltip-trigger"}` |
| **`drag`** | *Drag and drop.* Usage: `{"startSelector": "#item", "endSelector": "#cart"}` |

#### Input & Forms
| Command | Description |
|---------|-------------|
| **`fill_input`** | *Smart filling.* Usage: `{"placeholder": "Username", "value": "admin"}` |
| **`type`** | *Simulates real typing.* Usage: `{"text": "Hello World", "slowly": true}` |
| **`verify_form_state`** | *Checks validity of all forms.* |
| **`send_keyboard_shortcut`** | *Send key combinations.* Usage: `{"text": "Ctrl+S"}` |

#### Observation
| Command | Description |
|---------|-------------|
| **`get_page_structure`** | *Returns a simplified JSON map of the UI.* |
| **`find_elements`** | *Detailed list of all interactive elements.* |
| **`is_visible`** | *Checks visibility.* Usage: `{"selector": "#error-modal"}` |
| **`get_attribute`** | *Get attributes.* Usage: `{"selector": "img", "attribute": "src"}` |
| **`count`** | *Count matching elements.* Usage: `{"selector": "li.item"}` |
| **`debug_elements`** | *Get detailed debug info for buttons and inputs.* |
| **`get_title`** | *Get the document title.* |
| **`get_url`** | *Get the current URL.* |
| **`get_body_text`** | *Get the visible body text.* |

#### Advanced
| Command | Description |
|---------|-------------|
| **`wait`** | *Wait for element/time.* Usage: `{"duration": 1000}` or `{"text": "Loading"}` |
| **`navigate_to_hash`** | *Navigate to hash routes.* Usage: `{"text": "settings"}` |
| **`eval`** | *Execute custom JavaScript.* Usage: `{"code": "alert('Hello')"}` |
| **`console_log`** | *Write to app console.* Usage: `{"message": "Hello"}` |

---

## Advanced: HTTP Server Mode

For advanced use cases where you want a single long-lived server that multiple AI clients share, you can run the server in HTTP mode.

> **Note:** Most users don't need this. The standard setup auto-detects projects and handles multiple apps with zero extra config.

**Step 1:** Start the server:
```bash
npx @debugelectron/debug-electron-mcp@latest serve
npx @debugelectron/debug-electron-mcp@latest serve --port 4000
```

**Step 2:** Point your MCP config to the URL:
```json
{
  "mcpServers": {
    "debug-electron-mcp": {
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

**Step 3:** Pass `projectName` in tool calls (no auto-detect in HTTP mode):
```
send_command_to_electron({ projectName: "music-app", command: "get_title" })
```

**Health check:** `http://localhost:3100/health`

---

## Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup
```bash
git clone https://github.com/TheDarkSkyXD/debug-electron-mcp.git
cd debug-electron-mcp
npm install
npm run build
```

### Running Locally
```bash
npm run dev                               # stdio mode
npx tsx src/index.ts --project my-app     # explicit project scope
npx tsx src/index.ts serve                # HTTP mode
```

### Testing
```bash
npm test                  # unit tests
npm run test:react        # integration tests
```

---

## Troubleshooting

**"Target not found" / "No running Electron application"**
- Check your assigned port with `list_projects()`.
- Start your Electron app with `--remote-debugging-port=<port>`.
- Verify: open `http://localhost:<port>/json` in your browser.

**"Project 'xyz' is not registered"**
- This shouldn't happen with auto-detect. If it does, run `register_project({ projectName: "xyz" })`.
- Check `list_projects()` to see registered projects.

**Wrong project detected**
- The MCP uses your `package.json` name, or the folder name if no package.json exists.
- To override, use `--project` flag: `"args": ["-y", "@debugelectron/debug-electron-mcp@latest", "--project", "correct-name"]`

**"No free ports available"**
- Default range is 9222-9322 (100 ports).
- Free unused ports: `unregister_project({ projectName: "old-app" })`.

**"Selector is empty" error**
- **Wrong:** `{"command": "click_by_selector", "args": ".btn"}`
- **Correct:** `{"command": "click_by_selector", "args": {"selector": ".btn"}}`

---

## License

MIT License. See [LICENSE](LICENSE) for details.

### Credits
Forked and maintained by [Antigravity](https://github.com/TheDarkSkyXD), originally based on work by [halilural](https://github.com/halilural).
