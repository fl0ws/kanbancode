# Claude Code Kanban

A local kanban board for managing multiple simultaneous [Claude Code](https://docs.anthropic.com/en/docs/claude-code) tasks. Drag a card to the "Claude" column and a headless Claude Code process spawns automatically, works on your task, streams its thinking in real time, and moves the card back when done. Reply to continue the conversation.

## Features

- **Drag-and-drop board** with 4 columns: Not Started, Claude, Your Turn, Done
- **Automatic Claude spawning** with configurable concurrency pool and task queue
- **Live "Thoughts" stream** showing Claude's reasoning and tool use as it works
- **Chat-style conversation** with clean responses separate from thinking output
- **Conversation resume** via session ID — Claude picks up where it left off
- **Interactive questions** — Claude presents clickable options during planning, not just text
- **Project management** — organize tasks into projects, each with its own working directory
- **Project memory** — Claude saves learnings to `.claude-memory/` files; an idle "dreaming" process consolidates them into a clean CLAUDE.md index
- **Archive system** with search and restore
- **Configurable system prompt** for controlling Claude's behavior (planning phase, confidence threshold, subagent usage)
- **Filesystem browser** for selecting project directories
- **MCP server** for Claude Code integration
- **Windows-first** with cross-platform support

## Quick Install (Windows)

### One-click installer

1. Download [`install-standalone.bat`](https://github.com/fl0ws/kanbancode/raw/main/install-standalone.bat)
2. Double-click it

The installer will:
- Check for **Node.js** and install it via winget if missing
- Check for **Git** and install it via winget if missing
- Check for **Claude Code** and install it via npm if missing
- Clone the repository to `%LOCALAPPDATA%\ClaudeKanban`
- Install dependencies and build the production client
- Create a **"Claude Kanban"** desktop shortcut
- Offer to start the board immediately

To update later, run the installer again — it pulls the latest changes instead of re-cloning.

### Manual install

```bash
git clone https://github.com/fl0ws/kanbancode.git
cd kanbancode
npm install
npm run build
npm start
```

Open http://localhost:3001 in your browser.

### First launch

On first launch you'll be prompted to set the **maximum concurrent Claude processes**. This controls how many tasks Claude can work on simultaneously. Recommended: 3-5 depending on your machine and API quota. Tasks beyond the limit are queued automatically.

### Workflow

```
1. Create a project (header dropdown → Manage Projects)
2. Set the project's working directory to your codebase
3. Create a task with a title and description
4. Drag the card to the "Claude" column
5. Watch Claude's thinking in the thought bubble
6. Claude asks questions → click an option or type a custom answer
7. Claude finishes → card moves to "Your Turn"
8. Review the chat, reply to continue, or drag to "Done"
```

### Settings

Click **Settings** in the header to configure:

| Setting | Description |
|---|---|
| **Max Concurrent Processes** | How many Claude instances can run at once |
| **Claude Config Directory** | Sets `CLAUDE_CONFIG_DIR` for spawned processes. Useful for separating accounts (e.g. `~/.claude-work`) |
| **System Prompt** | Instructions added to every new task's initial prompt. Default includes planning phase, AskUserQuestion usage, subagent instructions, and memory saving |

### Project Memory

When a task completes, Claude saves key learnings (architecture decisions, patterns, gotchas) to `.claude-memory/` files in the project's working directory. After 5 minutes of idle time, a "dreaming" process consolidates these into clean topic-based files and rebuilds the `## Project Memory` section in the project's CLAUDE.md. New task spawns automatically benefit from this accumulated knowledge.

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express (ESM) |
| Database | SQLite via sql.js (pure JS, no native compilation) |
| Real-time | WebSocket (ws library) |
| Client | React 18 + Vite |
| State | Zustand |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| AI | Claude Code CLI (headless, stream-json output) |
| MCP | @modelcontextprotocol/sdk (stdio transport) |

## Architecture

The server is the single writer to SQLite. The MCP server proxies all calls through the REST API. Claude processes are managed by a worker pool with configurable concurrency and automatic queue draining. A state machine enforces valid column transitions server-side. All mutations broadcast WebSocket events for real-time UI sync across browser tabs.

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation, file map, data flows, API reference, and development conventions.

## npm Scripts

```bash
npm run build  # Build the client
npm start      # Start the server on port 3001
npm run dev    # Development mode (hot reload, for contributors)
npm run mcp    # Run MCP server standalone
```

## Prerequisites

- **Node.js** 18+ (tested on 25.x)
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- A valid Claude API subscription (the spawned processes use your Claude account)

## License

MIT
