# BOTC Companion

A real-time Storyteller companion app for **Blood on the Clocktower** (Trouble Brewing edition). Built as a Progressive Web App for tablets and phones — the host runs the Storyteller view, players join from their own devices.

---

## Features

### Lobby & Setup
- Create or join a room with a 6-character code
- Drag-to-reorder circular seating arrangement
- Real-time presence (online/offline indicators via Supabase Realtime)
- Bot placeholder seats for testing with fewer players

### Script Builder & Character Library
- Full Trouble Brewing character library with ability text
- Script builder to select which characters are in play
- Character reference page with team filtering

### Role Assignment
- Setup table automatically calculates correct Townsfolk/Outsider/Minion/Demon counts
- Baron and Drunk adjustments applied automatically
- Drunk players receive a fake Townsfolk role they think they are
- Individual role reveal cards (players tap to see their own role privately)

### Grimoire (Storyteller in-game view)
- Circular seating diagram with player status tokens
- Click any player to open the detail panel:
  - Toggle alive/dead
  - Toggle ghost vote used/available
  - Add/remove reminder tokens
  - Storyteller notes
- Phase tracker (Night 1 → Day 1 → Night 2 → …)
- Automatic win condition detection with override option
- Scarlet Woman succession modal

### Night Assistant
- Step-by-step wake order for every active character in the current script
- Role-specific UI per step:
  - **Poisoner** — select target, confirmation panel, auto-places `poisoner-poisoned` token
  - **Monk** — select target, auto-places `monk-protected` token
  - **Imp** — select kill target
  - **Scarlet Woman** — shows succession status based on Imp's action
  - **Ravenkeeper** — detects if killed by Imp; shows/picks target role
  - **Fortune Teller** — red herring picker (Night 1); YES/NO answer computed automatically
  - **Undertaker** — auto-populated with executed player from prior day
  - **Chef / Empath** — adjacent evil pairs / evil neighbour count computed live
  - **Spy** — full grimoire panel shown
  - **Washerwoman / Librarian / Investigator** — two-player selection + role token reveal; auto-selects token when only one match exists
  - **Demon step** — minion list + 3 bluff role selection
- Collapsible progress panel with Drunk/Poisoned badges
- Ephemeral token cleanup at start of each new night
- Skip and Previous navigation; position persisted to DB across refreshes

### Night Resolution (Rule Engine)
The rule engine runs client-side after all night steps are recorded:

**10-stage pipeline** (`src/engine/pipeline.ts`):

| Stage | Purpose |
|-------|---------|
| 1 | Validation — detect impossible states |
| 2 | Poison — flag impaired players |
| 3 | Protection — Monk notes who is protected |
| 4 | Information — Chef, Empath, FT, Washerwoman, etc. |
| 5 | Deaths — Imp kill, Soldier/Mayor resistance |
| 6 | Transforms — Scarlet Woman succession |
| 7 | Triggered — Ravenkeeper, etc. |
| 8 | Passive/Advisory — Butler, Spy, Recluse |
| 9 | Summary — final suggestion list |
| 10 | (reserved for future persistent-effect hooks) |

**Resolver coverage** (all Trouble Brewing roles with night actions):
Poisoner, Monk, Imp, Scarlet Woman, Ravenkeeper, Fortune Teller, Undertaker, Chef, Empath, Washerwoman, Librarian, Investigator, Butler, Recluse, Spy

**Resolution UI:**
- Toggle each suggested death on/off (Storyteller always has final say)
- Toggle suggested role changes (e.g. Scarlet Woman → Imp)
- Mark info suggestions where you gave different information
- Full event log with icons
- Commit → applies deaths/role changes to DB → advances to Day phase
- Win condition check after commit

### Day Assistant
- Phase timeline (Night 1 ✓ → Day 1 ▶ → …)
- Player grid with alive/dead status and ghost vote tracking
- **Nominations** — record nominator/nominee pairs; optionally consume a ghost vote
- **Execution** — confirmation dialog; marks player dead; records role snapshot for Undertaker
- **Slayer** — appears when Slayer is alive and ability not yet used; computes hit/miss
- **Butler reminder** — shows master restriction when Butler is alive
- **Mayor win check** — evaluates 3-alive / no-execution condition on demand
- Day notes (auto-saved on blur, synced via Realtime)
- Collapsible event history grouped by day
- Start Night → advances to next night, returns to Night Assistant

### Day Ability Engine (`src/engine/dayEngine.ts`)
Pure functions (no side effects) for:
- **Virgin** — first Townsfolk nomination triggers nominator execution
- **Saint** — execution triggers immediate Evil win
- **Slayer** — once-per-game Demon kill attempt
- **Mayor** — 3 alive + no execution = Good wins

### Win & Game Over
- Win page shows outcome, demon reveal, full role roster sorted by team
- Drunk players show their real role (and the fake role they thought they were)
- **Rematch** — wipes all game data, resets room to lobby → Script Builder → Role Assignment
- **New Game** — clears session, returns to landing page

### Game History (`/history`)
- Full-game event timeline grouped by phase
- Event type filtering and text search
- Player journey view (events for a selected player across all phases)
- Replay mode — step through phases read-only
- All significant events are recorded: role assignments, night actions, resolution outcomes, nominations, executions, day notes, tokens, game end

### Settings & Offline
- Offline banner when network is unavailable (via `useOnlineStatus` hook)
- Settings page

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript |
| Build | Vite 5 |
| Routing | react-router-dom v6 |
| Database & Realtime | Supabase (Postgres + Realtime channels) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Testing | Vitest (57 tests) |

---

## Project Structure

```
src/
├── App.tsx                    # Router with all page routes
├── types/index.ts             # All shared TypeScript types
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── roomUtils.ts           # generateRoomCode, saveSession, loadSession, clearSession
│   ├── gameHistory.ts         # recordEvent helpers (write to game_events table)
│   └── winConditions.ts       # detectWinCondition, detectScarletWomanPromotion, detectSaintExecution
├── data/
│   ├── troubleBrewing.ts      # Full Trouble Brewing character library
│   ├── nightOrder.ts          # Night step definitions + computeActiveSteps()
│   ├── reminderTokens.ts      # Reminder token definitions
│   └── setupTable.ts          # Player-count setup table (TB counts)
├── engine/
│   ├── types.ts               # GameState, NightResolution, PipelineContext, etc.
│   ├── stateEngine.ts         # Pure query functions (Layer 1)
│   ├── pipeline.ts            # 10-stage resolveNight() pipeline
│   ├── validation.ts          # Validation stage
│   ├── dayEngine.ts           # Day-phase ability resolution (pure)
│   └── resolvers/             # One file per role (Layer 2)
│       ├── index.ts           # RESOLVER_REGISTRY + RESOLVER_BY_ID map
│       ├── imp.ts / monk.ts / poisoner.ts / scarletWoman.ts
│       ├── fortuneTeller.ts / ravenkeeper.ts / undertaker.ts
│       ├── infoRoles.ts       # Chef, Empath, Washerwoman, Librarian, Investigator
│       └── passive.ts         # Butler, Recluse, Spy
├── components/
│   ├── GrimoireCircle.tsx     # Circular seating diagram
│   ├── GrimoireSeat.tsx       # Individual seat token
│   ├── PlayerDetailPanel.tsx  # Slide-up player info/action panel
│   ├── PlayerSeat.tsx         # Seat in lobby seating view
│   ├── CircularSeating.tsx    # Drag-to-reorder seating
│   ├── CharacterCard.tsx      # Character reference card
│   ├── RoleRevealCard.tsx     # Full-screen role reveal
│   ├── SortablePlayerItem.tsx # DnD-kit draggable row
│   └── OfflineBanner.tsx      # Offline indicator
├── hooks/
│   └── useOnlineStatus.ts
└── pages/
    ├── LandingPage.tsx         # /
    ├── CreateRoomPage.tsx      # /create
    ├── JoinRoomPage.tsx        # /join
    ├── LobbyPage.tsx           # /lobby
    ├── CharacterReferencePage.tsx # /characters
    ├── ScriptBuilderPage.tsx   # /script
    ├── RoleAssignmentPage.tsx  # /assign
    ├── GamePage.tsx            # /game  (Grimoire for host, role reveal for players)
    ├── NightAssistantPage.tsx  # /night
    ├── NightResolutionPage.tsx # /resolve
    ├── DayAssistantPage.tsx    # /day
    ├── GameHistoryPage.tsx     # /history
    ├── WinPage.tsx             # /win
    └── SettingsPage.tsx        # /settings

supabase/
├── schema.sql                 # Phase 1 — rooms, players
├── phase2.sql                 # Script column
├── phase3.sql                 # Room status, role column
├── phase4.sql                 # is_alive, ghost_vote_used, notes, reminder_tokens, day_events
├── phase4_5.sql               # day_notes
├── phase5.sql                 # night_actions, night_step_key
├── phase6.sql                 # is_bot, drunk_role
├── schema_phase7.sql          # night_events (rule engine)
├── schema_phase8.sql          # game_events (history)
└── schema_phase9.sql          # outcome, ended_at (win/end game)
```

---

## Database Schema

### Tables

| Table | Key Columns |
|-------|------------|
| `rooms` | `id`, `code` (6-char), `host_id`, `script` (char IDs), `status` (lobby/in_progress/completed), `phase` (e.g. "Night 1"), `night_step_key`, `outcome`, `ended_at` |
| `players` | `id`, `room_id`, `display_name`, `is_host`, `is_bot`, `seat_order`, `role`, `drunk_role`, `is_alive`, `ghost_vote_used`, `notes` |
| `night_actions` | `room_id`, `night_number`, `step_key`, `target_ids[]`, `notes` |
| `day_events` | `room_id`, `day_number`, `event_type` (nomination/execution), `payload` |
| `day_notes` | `room_id`, `day_number`, `notes` |
| `reminder_tokens` | `player_id`, `room_id`, `token_key` |
| `game_events` | `room_id`, `phase`, `event_type`, `description`, `affected_player_ids[]`, `metadata` |

All tables: REPLICA IDENTITY FULL, RLS enabled (open policies), added to `supabase_realtime` publication.

---

## Setup

### 1. Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Open the SQL Editor and run the schema files in order:
   ```
   schema.sql → phase2.sql → phase3.sql → phase4.sql → phase4_5.sql
   → phase5.sql → phase6.sql → schema_phase7.sql → schema_phase8.sql → schema_phase9.sql
   ```

### 2. Environment

```bash
cp .env.example .env
```

Fill in:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Run Tests

```bash
npm test
```

57 tests covering the state engine, all role resolvers, the pipeline, the day engine, and validation.

---

## Game Flow

```
Landing → Create Room → Lobby (drag to seat) → Script Builder
       → Role Assignment → Game (Grimoire)
           ↓
       Night Assistant (step through wake order)
           ↓
       Night Resolution (rule engine → override → commit)
           ↓
       Day Assistant (nominations, execution, day abilities)
           ↓
       (repeat Night → Day until win condition)
           ↓
       Win Page → Rematch or New Game
```

---

## Session Storage

- Key: `botc_session`
- Shape: `{ playerId, roomId, isHost }`
- Cleared on kick (DELETE event for own player ID) or "New Game"

---

## Realtime Channels

| Channel | Purpose |
|---------|---------|
| `lobby:{roomId}` | Presence + player INSERT/UPDATE/DELETE |
| `grimoire:{roomId}` | Player updates, room phase changes, reminder token changes |
| `game-end-watch:{roomId}` | Non-host players redirect to `/win` when room status → completed |
| `day:{roomId}` | Day events, player updates, day notes sync |

---

## Adding a New Script / Role

1. Add character definitions to a new data file (follow the `Character` interface in `src/types/index.ts`)
2. Create a resolver in `src/engine/resolvers/` implementing the `RoleResolver` interface
3. Register it in `src/engine/resolvers/index.ts`
4. Add night step definitions to `src/data/nightOrder.ts`
5. Add reminder token definitions to `src/data/reminderTokens.ts`

---

## Notes

- The rule engine is entirely **client-side** and **pure** — no network calls during resolution
- The Storyteller always has the final say; every engine suggestion can be overridden
- Node 18 engine warnings from `supabase-js 2.111` are harmless
