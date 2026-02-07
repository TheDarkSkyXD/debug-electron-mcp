# Debug Electron MCP

[![npm version](https://img.shields.io/npm/v/@debugelectron/debug-electron-mcp)](https://www.npmjs.com/package/@debugelectron/debug-electron-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)

**The ultimate Model Context Protocol (MCP) server for automating, debugging, and testing Electron applications.**

Use the power of AI to interact with ANY Electron application. Inspect the DOM, click buttons by text, fill forms, capture screenshots, and read console logs—all through a standardized protocol compatible with Claude Desktop, Cursor, and other MCP clients.

---

## 📚 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration (Required)](#-configuration-required)
- [Usage Guide](#-usage-guide)
  - [Core Workflow](#core-workflow)
  - [Tool Reference](#tool-reference)
  - [Interaction Commands](#interaction-commands)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

### 🔌 Universal Compatibility
- **Works with ANY Electron app**: No source code modifications required.
- **Zero-setup integration**: Connects purely via Chrome DevTools Protocol (CDP).
- **Cross-platform**: Supports Windows, macOS, and Linux.

### 🤖 Smart UI Automation
- **Semantic Interaction**: specific `click_by_text` and `fill_input` commands that "just work."
- **Visual Intelligence**: Take screenshots of specific windows to verify state.
- **Robust Actions**: Advanced `drag`, `hover`, `type`, and `wait` commands for complex workflows.

### 🔍 Deep Observability
- **DOM Inspection**: `get_page_structure` gives AI a clean copy of the interactive operational map.
- **Log Streaming**: Read main process, renderer, and console logs in real-time.
- **Performance**: Monitor memory, timing, and system metrics.

---

## 🚀 Quick Start

Add the server to your MCP configuration file. No environment variables are usually needed.

### VS Code / Cursor
Add to your `mcp_config.json` (usually in `%APPDATA%\Cursor\mcp_config.json` on Windows):

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

### Antigravity
Add to your Antigravity configuration:

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

### Claude Desktop
Add to your Claude Desktop config:

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

---

## 🛠 Configuration (Required)

**CRITICAL:** For this MCP server to work, your target Electron application **must be running with remote debugging enabled on port 9222**.

Choose **ONE** of the methods below to enable this:

### Method 1: Command Line Flag (Easiest)
Launch your app with the `--remote-debugging-port` flag.

```bash
# Direct electron launch
electron . --remote-debugging-port=9222

# Via npx
npx electron . --remote-debugging-port=9222

# Via npm script
npm start -- --remote-debugging-port=9222
```

### Method 2: package.json (Persistent)
Add a debug script to your `package.json`:

```json
"scripts": {
  "start": "electron .",
  "dev:debug": "electron . --remote-debugging-port=9222"
}
```
Then run `npm run dev:debug`.

### Method 3: Programmatic (Best for Codebase)
Updates your `main.js` to automatically enable debugging in dev mode.

```javascript
const { app } = require('electron');

// Enable if in dev mode or flag is present
if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  console.log('🔧 Remote debugging enabled on port 9222');
}
```

### ✅ Verification
Open `http://localhost:9222/json` in your browser. If you see a JSON list of targets, you are ready!

---

## 📖 Usage Guide

### Core Workflow

To effectively control an app, follow this "Loop of Action":

1.  **Inspect**: Use `get_page_structure` to see what buttons and inputs are available.
2.  **Target**: Identify the element you want (e.g., a button with text "Login").
3.  **Act**: Send a command like `click_by_text` or `fill_input`.
4.  **Verify**: Use `take_screenshot` or `get_title` to confirm the action succeeded.

### Tool Reference

These are the high-level tools exposed by the MCP server:

| Tool | Description |
|------|-------------|
| `launch_electron_app` | Starts an Electron app with debugging enabled automatically. |
| `get_electron_window_info` | Lists all open windows, their titles, and connection IDs. |
| `list_electron_windows` | Lists all available window targets across applications. |
| `take_screenshot` | Captures a screenshot of a specific window or the active one. |
| `read_electron_logs` | Streams console logs from the app (great for debugging errors). |
| **`send_command_to_electron`** | **The main tool.** Executes specific actions inside the app. |
| `close_electron_app` | Terminates the application. |

### Interaction Commands

Use these inside `send_command_to_electron`:

#### 🖱️ Clicking & Selection
| Command | Description |
|---------|-------------|
| **`click_by_text`** | *Best for buttons/links.* Usage: `{"text": "Submit"}` |
| **`click_by_selector`** | *Precise control.* Usage: `{"selector": ".submit-btn"}` |
| **`click_button`** | *Legacy click command.* Usage: `{"selector": "#btn"}` |
| **`select_option`** | *For dropdowns.* Usage: `{"text": "Category", "value": "Books"}` |
| **`hover`** | *Hover over elements.* Usage: `{"selector": ".tooltip-trigger"}` |
| **`drag`** | *Drag and drop.* Usage: `{"startSelector": "#item", "endSelector": "#cart"}` |

#### 📝 Input & Forms
| Command | Description |
|---------|-------------|
| **`fill_input`** | *Smart filling.* Usage: `{"placeholder": "Username", "value": "admin"}` |
| **`type`** | *Simulates real typing.* Usage: `{"text": "Hello World", "slowly": true}` |
| **`verify_form_state`** | *Checks validity of all forms.* |
| **`send_keyboard_shortcut`** | *Send key combinations.* Usage: `{"text": "Ctrl+S"}` |

#### 👁️ Observation
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

#### ⚙️ Advanced
| Command | Description |
|---------|-------------|
| **`wait`** | *Wait for element/time.* Usage: `{"duration": 1000}` or `{"text": "Loading"}` |
| **`navigate_to_hash`** | *Navigate to hash routes.* Usage: `{"text": "settings"}` |
| **`eval`** | *Execute custom JavaScript.* Usage: `{"code": "alert('Hello') "}` |
| **`console_log`** | *Write to app console.* Usage: `{"message": "Hello"}` |

---

## 🏗️ Development

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

### Testing
We have a comprehensive test suite including React compatibility tests.
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:react
```

### Demo App
Try the included demo to verify functionality:
```bash
cd examples/demo-app
npm install
npm run dev
```

---

## ❓ Troubleshooting

**"Target not found" / "No running Electron application"**
- Ensure the app was started with `--remote-debugging-port=9222`.
- Check if `http://localhost:9222/json` loads in your browser.
- Try ports 9223-9225 if you have multiple instances.

**"Selector is empty" error**
- **Wrong:** `{"command": "click_by_selector", "args": ".btn"}`
- **Correct:** `{"command": "click_by_selector", "args": {"selector": ".btn"}}` (Always use named properties!)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

### Credits
Forked and maintained by [Antigravity](https://github.com/TheDarkSkyXD), originally based on work by [Halil Ural](https://github.com/halilural).
