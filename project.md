# Claude Code Kanban Board

A local kanban board designed specifically for managing tasks delegated to Claude Code (Anthropic's AI CLI). When a user drags a card into the "Claude" column, the server automatically spawns a Claude Code process in the task's working directory. Claude works headlessly, logs progress in real time to the board, and moves the card to "Your Turn" when done. The user can reply and send it back to Claude for follow-up work. When a new task is delegated to Claude, always start in planning mode with the prompt "Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence."

---

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express (ESM modules) |
| Real-time | WebSocket (ws library) |
| Persistence | SQLite database (`kanban.db`) via `better-sqlite3` |
| MCP server | `@modelcontextprotocol/sdk` (stdio transport) |
| Client | React 18 + Vite |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Schema validation | Zod (MCP tool schemas) |

---

## Key Features

### 1. Automatic Claude Code Spawning
When a card is moved to the **Claude** column (via drag-and-drop or the REST API), the server calls `spawnClaudeProcess()`:
- Runs `claude --dangerously-skip-permissions -p <prompt> --output-format stream-json --verbose` in the task's `working_dir`.
- The prompt instructs Claude to call `get_task_details`, `claim_task`, do the work, and move to `your_turn` when done.
- If the task has a stored `conversation_id`, uses `--resume <id>` to resume the previous conversation thread.
- On Windows, spawns via `cmd.exe /c claude ...` with `windowsHide: true`.

### 2. Conversation Resume
After each Claude process exits, the server extracts the `session_id` from the final JSON result line and stores it as `conversation_id` on the task. Next time the card is dragged back to Claude, the previous conversation is resumed with a context-aware re-entry prompt.

### 3. Live Output Streaming
The server parses Claude's `stream-json` JSONL output:
- Extracts human-readable text from `assistant` message blocks.
- Strips ANSI codes and control characters.
- Batches output and broadcasts `task:output` WebSocket events every 400 ms.
- The UI shows a live terminal-style snippet ("Working…" pane) in the TaskDetail panel.

### 4. Input Detection & Needs-Input Banner
The server watches for patterns like `[y/n]`, `Allow?`, `Would you like to`, etc. in Claude's output. If detected (or if the process goes silent for 8 seconds with unterminated output), it sets `needs_input: true` and saves the last 800 chars as `pending_prompt`. The UI shows a yellow warning banner with an inline text field so the user can type a response. (Note: in headless mode stdin is closed, so this is informational; the stop button is the action.)

### 5. Stop Process
`POST /api/tasks/:id/stop` kills the Claude process (full process tree on Windows via `taskkill /T /F`), then moves the card to `your_turn`.

### 6. Real-Time WebSocket Sync
All state changes broadcast WebSocket events to all connected browsers:
- `task:created`, `task:moved`, `task:updated`, `task:deleted`, `task:archived`, `task:unarchived`
- `task:activity` — new activity log entry
- `task:output` — live terminal snippet
- `tasks:reordered` — drag-and-drop reorder within a column

The React client handles all events to update local state without polling.

### 7. MCP Server (for Claude Code Integration)
`server/mcp-server.js` is a stdio MCP server that Claude Code sessions connect to. It proxies calls to the Express REST API. Tools:

| Tool | Description |
|---|---|
| `get_tasks` | List tasks, optionally filtered by column |
| `get_task_details` | Full task + activity log (with smart summary/new-activity display) |
| `claim_task` | Set working_dir, branch, session_id on card; logs "Session started" |
| `move_task` | Move card to any column |
| `log_progress` | Append a progress entry (author: claude) |
| `add_note` | Append a note for the user |
| `update_task` | Edit title or description |

### 8. Filesystem Browser
`GET /api/fs/browse?path=...` returns directory listings (non-hidden dirs only). `POST /api/fs/mkdir` creates a new folder. The `FolderPicker` modal uses this to let users browse and select a working directory when creating tasks.

### 9. Drag-and-Drop with Reordering
Uses `@dnd-kit` with:
- `PointerSensor` with a 6px activation distance to prevent accidental drags
- Cross-column moves: send `POST /api/tasks/:id/move`
- Within-column reordering: send `POST /api/tasks/reorder` with sorted ID array
- `DragOverlay` renders a ghost card while dragging
- `pointerWithin` collision detection, falling back to `closestCenter`

### 10. Task Detail Side Panel
Clicking a card opens a right-side panel (460px wide) with:
- Column indicator + color dot
- Editable title and description (inline form)
- Working directory and branch tags
- Live output pane (when Claude is running)
- Needs-input banner (when Claude is waiting)
- Full activity log with chat-bubble layout (Claude vs User)
- Quick-move buttons (advance to next column, jump to Done, Stop, Archive)
- Comment/reply form: in "Your Turn", submitting sends the card back to Claude

### 11. Archive System
- `POST /api/tasks/:id/archive` soft-deletes (sets `archived: true`)
- `GET /api/tasks/archived?q=<search>` returns archived tasks with optional text search
- `ArchiveModal` lists archived tasks and lets users restore them
- Archived tasks are hidden from the main board

### 12. Theme & Settings
- Dark/light mode toggle, stored in `localStorage`
- Settings popover (gear icon) for toggling usage bar and setting token limit preset
- Last-used working directory persisted to `localStorage`

---

## REST API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks` | All active (non-archived) tasks with activity logs |
| POST | `/api/tasks` | Create task (`title`, `description`, `working_dir`) |
| GET | `/api/tasks/archived` | Archived tasks (optional `?q=search`) |
| GET | `/api/tasks/:id` | Single task with activity log |
| PATCH | `/api/tasks/:id` | Update fields (title, description, needs_input, etc.) |
| POST | `/api/tasks/:id/move` | Move to column — triggers Claude spawn if `claude` |
| POST | `/api/tasks/:id/claim` | Set working_dir, branch, session_id |
| POST | `/api/tasks/:id/log` | Add activity log entry (`author`, `message`) |
| POST | `/api/tasks/:id/stop` | Kill Claude process, move to your_turn |
| POST | `/api/tasks/:id/archive` | Archive task |
| POST | `/api/tasks/:id/unarchive` | Restore archived task |
| DELETE | `/api/tasks/:id` | Permanently delete task and its activity log |
| POST | `/api/tasks/reorder` | Reorder tasks within a column (`column`, `ids[]`) |
| GET | `/api/usage` | Current Claude billing block stats via ccusage |
| GET | `/api/fs/browse` | List directories at `?path=` |
| POST | `/api/fs/mkdir` | Create a new folder (`parent`, `name`) |

---

## npm Scripts

```bash
npm run dev    # concurrently: node server/index.js + vite dev server (ports 3001 + 5173)
npm run build  # vite build → client/dist/
npm start      # production: serve client/dist as static + API on port 3001
npm run mcp    # run MCP server standalone (for debugging)
```

---

## Client Dependencies

```json
{
  "@dnd-kit/core": "drag-and-drop primitives",
  "@dnd-kit/sortable": "sortable list utilities",
  "react": "18",
  "react-dom": "18",
  "vite": "build tool + dev server"
}
```

## Server Dependencies

```json
{
  "@modelcontextprotocol/sdk": "MCP server framework",
  "better-sqlite3": "SQLite driver — synchronous API, no callback overhead",
  "cors": "CORS middleware",
  "express": "HTTP server",
  "ws": "WebSocket server",
  "zod": "schema validation for MCP tool params",
}
```

---

## Architecture Notes

- **Single writer**: All writes to `kanban.db` go through the Express process. The MCP server never touches the database directly — it calls the REST API. This avoids SQLite write-lock contention when multiple Claude Code sessions are active.
- **No auth**: Designed as a single-user local tool. No authentication layer.
- **Headless Claude**: Uses `-p` (print mode) with `--dangerously-skip-permissions` so no TTY or interactive approval is needed.
- **Position-based ordering**: Tasks have a `position` integer per column. Drag reorder updates positions in bulk via `/api/tasks/reorder` using a single transaction.
- **Hydration**: `db.js` always returns tasks with their `activity_log` rows attached as an array, queried separately by `task_id` and sorted by `timestamp`.
- **Prepared statements**: All queries in `db.js` use `better-sqlite3` prepared statements, compiled once at startup for performance and SQL-injection safety.
- **CASCADE deletes**: Deleting a task automatically removes its activity log rows via the foreign key `ON DELETE CASCADE`.

---

## Workflow Summary

```
1. User creates task in "Not Started" with title, description, working_dir
2. User drags card to "Claude" column
3. Server spawns: claude --dangerously-skip-permissions -p "<prompt>" in working_dir
4. Claude calls get_task_details → claim_task → implements task - ask questions of the user, if not at least 95% sure how to implement the task
5. Claude calls log_progress regularly (visible in UI live)
6. Claude calls add_note (summary) → move_task to your_turn
7. UI shows card in "Your Turn" with activity log
8. User types reply in panel → card moves back to Claude (conversation resumed)
9. Repeat until done; user clicks "Done" or drags to Done column
10. User can archive from Done column
```
