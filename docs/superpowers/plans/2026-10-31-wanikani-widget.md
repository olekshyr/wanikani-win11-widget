# WaniKani Desktop Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows desktop tile that shows the number of WaniKani reviews available right now, sits behind all other windows, opens the dashboard when clicked, and starts at login.

**Architecture:** An Electron app. All logic that can be tested without Electron lives in `src/core/` as pure TypeScript with vitest tests: counting reviews, the API client, the tile state machine, the view model, the refresh scheduler, settings, the token store, and position handling. `src/main/` wires the core to Electron: the windows, the context menu, safeStorage, `powerMonitor`, and Win32 z-order calls made through `koffi`. The renderer is a dumb view. It receives a ready-made `TileView` over IPC and sends pointer events back.

**Tech Stack:** Electron 45.2.1, TypeScript 7.0.2 (fall back to the latest 5.x if `tsc` from 7.0.2 misbehaves), vitest 5.0.5, koffi 3.3.6, electron-builder 26.18.0 (NSIS, per-user), @types/node 24.

**Spec:** `docs/superpowers/specs/2026-10-31-wanikani-widget-design.md`

## Global Constraints

- Windows 11 only. Node 24.15 and npm 11.12 are installed. No Rust.
- API: `GET https://api.wanikani.com/v2/summary` with the headers `Authorization: Bearer <token>` and `Wanikani-Revision: 20170710`.
- Dashboard URL: `https://www.wanikani.com/dashboard`. Token page URL: `https://www.wanikani.com/settings/personal_access_tokens`.
- Tile: about 110×110 px, WaniKani blue `#00aaff`, rounded corners, soft shadow, a white bold count of about 40 px, and "reviews" underneath.
- The tile sits at the bottom of the normal window stack, above the desktop icons (it may cover them). It never shows in the taskbar or Alt+Tab. It stays visible on Win+D. It only needs to appear on one virtual desktop.
- The default position is the primary display's work area top-left plus 16 px. It starts **locked**. "Start with Windows" defaults to **on**.
- The token is stored only through `safeStorage` encryption, never in plain text.
- Refreshing happens only at: startup; HH:00:30 every hour; resume from sleep; network back; "Refresh now"; and every 10 minutes ×6 after the dashboard is opened. There is no other polling. While offline, check `net.isOnline()` every 5 minutes, and fetch only if it returns true.
- Single instance only.

## Review Focus

1. **A review becomes available exactly at the hour boundary** (`available_at` == now, in UTC, while the user is in another time zone). It must be counted. Test in Task 1.
2. **A user with nothing scheduled** (an empty `reviews` array, `next_reviews_at: null`, for example in vacation mode) must show the "done" state, not an error. Test in Task 1.
3. **A token pasted with surrounding spaces or a trailing newline** must still work. Test in Task 2.
4. **The laptop sleeps across several hours.** After resume, the hourly timer must re-arm to the *next* real HH:00:30, not fire on a stale schedule. Test in Task 4.
5. **Overlapping refresh triggers** (a burst tick, the hourly tick, and a manual refresh at the same moment) must not send concurrent API calls. Test in Task 4.

---

### Task 1: Project scaffold and review counting

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.renderer.json`, `vitest.config.ts`, `.gitignore`, `scripts/copy-static.mjs`
- Create: `src/core/types.ts`, `src/core/summary.ts`
- Test: `tests/summary.test.ts`

**Interfaces:**
- Produces (`src/core/types.ts`):
  ```ts
  export interface ReviewBucket { available_at: string; subject_ids: number[] }
  export interface SummaryResponse { data: { reviews: ReviewBucket[]; next_reviews_at: string | null } }
  ```
- Produces: `countAvailableReviews(summary: SummaryResponse, now: Date): number` in `src/core/summary.ts`
- Produces: npm scripts `build`, `start`, `test`, `dist`

- [ ] **Step 1: Initialise the repo and the project**

Run `git init`. Write a `.gitignore` covering `node_modules/`, `dist/`, `release/`, and `.superpowers/`. In `package.json`: `"main": "dist/main/main.js"`, `"productName": "WaniKani Widget"`, and pin the exact devDependency versions from the Tech Stack. koffi goes in `dependencies`. Scripts:
- `build`: `tsc -p tsconfig.json && tsc -p tsconfig.renderer.json && node scripts/copy-static.mjs`
- `start`: `npm run build && electron .`
- `test`: `vitest run`
- `dist`: `npm run build && electron-builder --win nsis`

`tsconfig.json` compiles `src/core`, `src/main`, and `src/preload` to `dist/` as CommonJS with `strict: true`. `tsconfig.renderer.json` compiles `src/renderer` to `dist/renderer` as ES2022 modules with the DOM lib. `copy-static.mjs` copies `src/renderer/*.html` and `*.css` into `dist/renderer/`. Vitest picks up `tests/**/*.test.ts`.

Run: `npm install`. Expected: it completes without errors.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/summary.test.ts
const s = (reviews: ReviewBucket[]): SummaryResponse => ({ data: { reviews, next_reviews_at: null } });
const now = new Date('2026-10-31T14:20:00Z');

test('sums subject_ids of all past-due buckets', () => {
  expect(countAvailableReviews(s([
    { available_at: '2026-10-31T13:00:00.000000Z', subject_ids: [1, 2] },
    { available_at: '2026-10-31T14:00:00.000000Z', subject_ids: [3] },
    { available_at: '2026-10-31T15:00:00.000000Z', subject_ids: [4, 5, 6] },
  ]), now)).toBe(3);
});
test('counts a bucket whose available_at equals now', () => {
  expect(countAvailableReviews(s([{ available_at: '2026-10-31T14:00:00.000000Z', subject_ids: [7, 8] }]),
    new Date('2026-10-31T14:00:00Z'))).toBe(2);
});
test('returns 0 for an empty reviews array', () => {
  expect(countAvailableReviews(s([]), now)).toBe(0);
});
test('returns 0 when only future buckets exist', () => {
  expect(countAvailableReviews(s([{ available_at: '2026-10-31T15:00:00Z', subject_ids: [1] }]), now)).toBe(0);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test`. Expected: FAIL, because `countAvailableReviews` is not defined.

- [ ] **Step 4: Implement `countAvailableReviews` in `src/core/summary.ts`**

Compare times with `Date.parse(available_at) <= now.getTime()`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test`. Expected: 4 tests pass.

- [ ] **Step 6: Commit**

`git add -A && git commit -m "feat: scaffold project and count available reviews"`

---

### Task 2: WaniKani API client

**Files:**
- Create: `src/core/wanikani.ts`
- Test: `tests/wanikani.test.ts`

**Interfaces:**
- Consumes: `countAvailableReviews`, `SummaryResponse` (Task 1)
- Produces (add to `src/core/types.ts`):
  ```ts
  export type FetchResult =
    | { kind: 'ok'; count: number }
    | { kind: 'unauthorized' }
    | { kind: 'offline' }
    | { kind: 'api-error' };
  ```
- Produces: `fetchReviewCount(token: string, deps?: { fetch?: typeof fetch; now?: () => Date }): Promise<FetchResult>`
- Produces: `normalizeToken(input: string): string`
- Produces: `export const DASHBOARD_URL = 'https://www.wanikani.com/dashboard'` and `export const TOKEN_SETTINGS_URL = 'https://www.wanikani.com/settings/personal_access_tokens'`

- [ ] **Step 1: Write the failing tests**

Use a fake `fetch` that records its arguments and returns a `new Response(...)` or throws.

```ts
test('sends bearer token and revision header to /v2/summary', ...)
  // expect url === 'https://api.wanikani.com/v2/summary'
  // expect headers Authorization === 'Bearer abc', 'Wanikani-Revision' === '20170710'
test('200 with valid body → ok with count', ...)            // body with 2 past-due ids → { kind: 'ok', count: 2 }
test('401 → unauthorized', ...)
test('500 → api-error', ...)
test('429 → api-error', ...)
test('200 with non-JSON body → api-error', ...)
test('200 with JSON missing data.reviews → api-error', ...)
test('fetch throws TypeError("fetch failed") → offline', ...)
test('fetch throws AbortError/TimeoutError → offline', ...)
test('normalizeToken trims spaces and newlines', () => {
  expect(normalizeToken('  abc-123\r\n')).toBe('abc-123');
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- wanikani`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `fetchReviewCount` and `normalizeToken` in `src/core/wanikani.ts`**

Pass `signal: AbortSignal.timeout(15000)`. Any exception from `fetch` itself is `offline`. Any exception while parsing or validating the body is `api-error`. Only status 401 is `unauthorized`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`. Expected: all tests pass.

- [ ] **Step 5: Commit**

`git commit -am "feat: WaniKani summary client"` (run `git add` on the new files first)

---

### Task 3: Tile state machine and view model

**Files:**
- Create: `src/core/state.ts`, `src/core/view.ts`
- Test: `tests/state.test.ts`, `tests/view.test.ts`

**Interfaces:**
- Consumes: `FetchResult` (Task 2)
- Produces (add to `types.ts`):
  ```ts
  export type TileState =
    | { kind: 'setup' } | { kind: 'loading' }
    | { kind: 'reviews'; count: number } | { kind: 'done' }
    | { kind: 'offline' } | { kind: 'token-invalid' }
    | { kind: 'api-error'; lastCount: number | null };
  export interface TileView { main: string; sub: string; tone: 'blue' | 'grey' | 'dark'; dimmed: boolean; offlineIcon: boolean; unlocked: boolean }
  export type ClickAction = 'open-dashboard' | 'open-token-window' | 'none';
  ```
- Produces: `nextTileState(prev: TileState, result: FetchResult): TileState` in `state.ts`
- Produces: `clickAction(state: TileState, locked: boolean): ClickAction` in `state.ts`
- Produces: `tileView(state: TileState, locked: boolean): TileView` in `view.ts`

- [ ] **Step 1: Write the failing tests**

`nextTileState`:
- ok with count 5 → `{kind:'reviews',count:5}`
- ok with count 0 → `{kind:'done'}`
- unauthorized → `token-invalid`
- offline → `offline`
- api-error after `reviews 5` → `{kind:'api-error',lastCount:5}`
- api-error after `done` → `lastCount: 0`
- api-error after `api-error lastCount 3` → `lastCount: 3`
- api-error after `loading` or `offline` → `lastCount: null`

`clickAction`:
- any state with `locked=false` → `'none'`
- locked: `reviews`, `done`, `offline`, `api-error` → `'open-dashboard'`
- locked: `setup`, `token-invalid` → `'open-token-window'`
- locked: `loading` → `'none'`

`tileView` (exact copy):

| state | main | sub | tone | dimmed | offlineIcon |
|---|---|---|---|---|---|
| setup | `Set up` | `WaniKani` | grey | false | false |
| loading | `…` | `reviews` | blue | false | false |
| reviews 42 | `42` | `reviews` | blue | false | false |
| reviews 1 | `1` | `review` | blue | false | false |
| done | `0` | `reviews` | grey | false | false |
| offline | `Offline` | `` | dark | false | true |
| token-invalid | `Token` | `invalid` | grey | false | false |
| api-error 7 | `7` | `reviews` | blue | true | false |
| api-error 0 | `0` | `reviews` | grey | true | false |
| api-error null | `…` | `reviews` | blue | true | false |

Also: `unlocked` equals `!locked`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npm test`. Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Implement the three functions** as exhaustive `switch` statements on `state.kind`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npm test`. Expected: all tests pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: tile state machine and view model"`

---

### Task 4: Refresh scheduler

**Files:**
- Create: `src/core/scheduler.ts`
- Test: `tests/scheduler.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function msUntilNextHourlyCheck(now: Date): number   // to the next HH:00:30 strictly after now
  export function singleFlight(fn: () => Promise<void>): () => Promise<void>  // concurrent calls share one in-flight run
  export class RefreshScheduler {
    constructor(refresh: () => void, isOnline: () => boolean)
    start(): void              // refresh() now, then arm the hourly chain
    onDashboardOpened(): void  // refresh() every 10 min, 6 times; calling again restarts the burst
    onResume(): void           // refresh() now and re-arm the hourly timer from the real current time
    setOffline(offline: boolean): void  // true: every 5 min, if isOnline() then refresh(); false: stop that check
    stop(): void               // clear all timers
  }
  ```

- [ ] **Step 1: Write the failing tests**

Use `vi.useFakeTimers()` and `vi.setSystemTime()`.
- `msUntilNextHourlyCheck(new Date('2026-10-31T14:00:00'))` → `30_000`. `14:00:30` → `3_600_000`. `14:59:59` → `31_000`.
- `start()` at 14:20:00 calls refresh once immediately. After advancing to 15:00:30 the count is 2, and after advancing to 16:00:30 it is 3.
- After `start()` at 14:00:40, `onDashboardOpened()` at 14:05: advancing to 15:05 adds 7 calls (burst at 14:15 through 15:05 = 6, plus the 15:00:30 hourly call). Advancing another 60 minutes adds only 1 (the 16:00:30 hourly call).
- Calling `onDashboardOpened()` twice 15 minutes apart: the burst restarts, so 6 more calls follow the second call and no calls are left over from the first burst.
- `setOffline(true)` with `isOnline` → false: advancing 30 minutes adds no calls. With `isOnline` switched to true, the next 5-minute tick calls refresh. `setOffline(false)` stops the ticks.
- **Sleep across hours:** `start()` at 14:20, then `vi.setSystemTime('2026-10-31T18:42:00')` without advancing the timers, then `onResume()`: one immediate call, and the next hourly call happens at 19:00:30 (advance 18m29s → none, +2s → one).
- `singleFlight`: three calls while the first promise is pending result in the underlying fn being called once. After it resolves, the next call runs it again.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npm test -- scheduler`. Expected: FAIL.
- [ ] **Step 3: Implement** with chained `setTimeout`s for the hourly check (re-arm after each run using `msUntilNextHourlyCheck(new Date())`) and `setInterval` for the burst and the offline check.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npm test`. Expected: all tests pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: refresh scheduler"`

---

### Task 5: Settings, token store, position

**Files:**
- Create: `src/core/settings.ts`, `src/core/tokenStore.ts`, `src/core/position.ts`
- Test: `tests/settings.test.ts`, `tests/tokenStore.test.ts`, `tests/position.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Settings { position: { x: number; y: number } | null; locked: boolean; startWithWindows: boolean }
  export const DEFAULT_SETTINGS: Settings = { position: null, locked: true, startWithWindows: true };
  export function loadSettings(file: string): Settings
  export function saveSettings(file: string, s: Settings): void

  export interface StringCrypto { encryptString(s: string): Buffer; decryptString(b: Buffer): string }
  export function createTokenStore(file: string, crypto: StringCrypto): { load(): string | null; save(token: string): void }

  export interface Rect { x: number; y: number; width: number; height: number }
  export const TILE_MARGIN = 16;
  export function resolvePosition(saved: { x: number; y: number } | null, workAreas: Rect[], primary: Rect, size: { width: number; height: number }): { x: number; y: number }
  ```

- [ ] **Step 1: Write the failing tests** (use `fs.mkdtempSync(os.tmpdir())` for the files)
  - settings: missing file → `DEFAULT_SETTINGS`. Round trip of `{position:{x:300,y:40},locked:false,startWithWindows:false}`. Corrupt JSON → defaults. A partial file `{"locked":false}` → the defaults merged with `locked:false`.
  - tokenStore: use a fake crypto that reverses the string and base64-encodes it. `save('abc')` then `load()` → `'abc'`. The file contents must not contain `abc`. Missing file → `null`. `decryptString` throws → `null`.
  - position: `null` saved → `{x: primary.x+16, y: primary.y+16}`. A saved point whose tile centre is inside a second work area (`{x:1920,y:0,width:1920,height:1040}`) is kept. A saved point whose centre is in no work area → the default.
- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write settings with `JSON.stringify` and the token as raw bytes. Create parent directories with `{recursive:true}`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npm test`. Expected: all tests pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: settings, token store, position resolution"`

---

### Task 6: Tile window on the desktop layer (Electron)

**Files:**
- Create: `src/main/main.ts`, `src/main/tileWindow.ts`, `src/main/desktopLayer.ts`, `src/main/menu.ts`
- Create: `src/preload/tilePreload.ts`
- Create: `src/renderer/tile.html`, `src/renderer/tile.css`, `src/renderer/tile.ts`

**Interfaces:**
- Consumes: everything in Tasks 1–5.
- Produces, for the IPC channels the tile preload exposes as `window.tile`:
  - main → renderer: `'tile:view'` with a `TileView` → `tile.onView(cb: (v: TileView) => void)`
  - renderer → main: `'tile:click'`, `'tile:context-menu'`, `'tile:move-to'` with `{x:number,y:number}` in screen DIPs, `'tile:drag-end'`, and `'tile:online'`
- Produces: in `desktopLayer.ts`, `attachToDesktop(win: BrowserWindow): void` and `sendToBottom(win: BrowserWindow): void`
- Produces: in `main.ts`, `refresh(): Promise<void>` (single-flight) and `openTokenWindow()` as a stub that Task 7 replaces

- [ ] **Step 1: Desktop layer through koffi**

Load `user32.dll`. Read the HWND from `win.getNativeWindowHandle()`, which returns an 8-byte buffer read with `readBigUInt64LE(0)`. `attachToDesktop`:
- set the owner with `SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT = -8, FindWindowW("Progman", null))`
- OR `WS_EX_TOOLWINDOW = 0x80` | `WS_EX_NOACTIVATE = 0x08000000` into `GWL_EXSTYLE = -20`
- then call `sendToBottom`

`sendToBottom`: `SetWindowPos(hwnd, HWND_BOTTOM = 1, 0, 0, 0, 0, SWP_NOSIZE 0x1 | SWP_NOMOVE 0x2 | SWP_NOACTIVATE 0x10)`.

- [ ] **Step 2: Tile window and renderer**

`createTileWindow(pos)` creates a window with:
- 130×130 (the 110 px tile plus a 10 px margin for the shadow)
- `frame:false, transparent:true, resizable:false, skipTaskbar:true, focusable:false, hasShadow:false, show:false`
- `webPreferences: { preload, contextIsolation:true, sandbox:true }`

After `ready-to-show`, call `attachToDesktop`, then `showInactive()`. Also call `sendToBottom` after every click, drag end and menu close.

The renderer draws the `TileView`:
- tone classes: blue `#00aaff`, grey `#9aa0a6`, dark `#2b2f36`
- `dimmed` → opacity 0.5
- `unlocked` → a 2 px dashed white outline and `cursor: move`
- `offlineIcon` → an inline SVG of a crossed-out wifi icon

Pointer handling: when unlocked, `pointerdown` stores the client offset and calls `setPointerCapture`. `pointermove` sends `tile:move-to` with `{x: e.screenX - ox, y: e.screenY - oy}`. `pointerup` sends `tile:drag-end`. When locked, a left `click` sends `tile:click`. `contextmenu` sends `tile:context-menu`. `window` `online` sends `tile:online`.

- [ ] **Step 3: Menu and main wiring**

`buildTileMenu({ locked, startWithWindows, onRefresh, onToggleLock, onChangeToken, onToggleStartup, onQuit })` builds the menu in this order: `Refresh now`, `Unlock position` or `Lock position`, `Change token…`, `Start with Windows` (checkbox), separator, `Quit`. Pop it up over the tile window.

`main.ts`:
- `requestSingleInstanceLock()`, quitting if it fails
- load the settings from `app.getPath('userData')/settings.json`
- create the token store with `safeStorage` and `userData/token.bin`
- create the window at `resolvePosition(...)`, using `screen.getAllDisplays()` work areas and size 130×130
- state starts at `setup` when there's no token, otherwise `loading`
- `refresh` (wrapped in `singleFlight`) does `fetchReviewCount` → `nextTileState` → send `tileView`, then calls `scheduler.setOffline(state.kind==='offline')`
- `tile:click` → `clickAction`: `open-dashboard` → `shell.openExternal(DASHBOARD_URL)` + `scheduler.onDashboardOpened()`; `open-token-window` → `openTokenWindow()`
- `tile:move-to` → `setPosition(Math.round(x), Math.round(y))`; `tile:drag-end` → save the position
- `powerMonitor.on('resume')` → `scheduler.onResume()`
- `tile:online` → `refresh()`
- `RefreshScheduler(refresh, () => net.isOnline())`, then call `.start()` once a token exists

- [ ] **Step 4: Manual verification** (paste a real token into `token.bin` through a temporary dev path, or wait for Task 7). Run: `npm start`. Check each of these:
  - the tile appears at the top-left with the real count
  - it is absent from the taskbar and Alt+Tab
  - opening and clicking another window keeps the tile behind it
  - **Win+D leaves the tile visible**
  - right-click shows the menu
  - Unlock shows the dashed outline and the tile can be dragged
  - Lock removes the outline
  - restarting the app restores the position
  - with a locked tile, clicking opens the dashboard in the default browser
  - turning off Wi-Fi and choosing "Refresh now" shows Offline; turning Wi-Fi back on returns the count within a few seconds

  **If Win+D hides the tile:** add a `SetWinEventHook(EVENT_SYSTEM_FOREGROUND = 3)` through koffi. When the foreground window class is `WorkerW` or `Progman`, call `showInactive()` + `sendToBottom()`, then check again.

- [ ] **Step 5: Commit.** `git commit -m "feat: desktop tile window, menu, drag and lock"`

---

### Task 7: Token window

**Files:**
- Create: `src/main/tokenWindow.ts`, `src/preload/tokenPreload.ts`, `src/renderer/token.html`, `src/renderer/token.css`, `src/renderer/token.ts`
- Modify: `src/main/main.ts` (replace the `openTokenWindow` stub)

**Interfaces:**
- Consumes: `fetchReviewCount`, `normalizeToken`, `TOKEN_SETTINGS_URL`, the token store
- Produces: `openTokenWindow(onSaved: (token: string) => void): void`. It focuses the existing window instead of opening a second one.
- IPC: `ipcMain.handle('token:save', (_, raw: string) => Promise<{ ok: true } | { ok: false; error: 'invalid' | 'unreachable' }>)` and `'token:open-link'`

- [ ] **Step 1: Implement the window**

An ordinary focusable window, 420×260, not resizable, with no menu bar, titled "WaniKani Widget — API token". The copy:
- `Paste your WaniKani personal access token. A token with default (read-only) permissions is enough.`
- a link `Create a token on WaniKani` → `token:open-link` → `shell.openExternal(TOKEN_SETTINGS_URL)`
- a password input and a `Save` button

`token:save` behaves like this:
- normalise the token, then `fetchReviewCount`
- `ok` → save the token and return `{ok:true}`. The window closes, and main sets the state to `loading` and calls `scheduler.start()` (or `refresh()` if the scheduler is already running).
- `unauthorized` → return `invalid`, shown as `That token was rejected by WaniKani.`
- `offline` or `api-error` → return `unreachable`, shown as `Couldn't reach WaniKani, try again.`, and don't save the token

- [ ] **Step 2: Wire it up.** Clicking the tile in `setup` or `token-invalid`, and the `Change token…` menu item, open the window.

- [ ] **Step 3: Manual verification.** Delete `userData/token.bin` and run `npm start`. Check each of these:
  - the tile shows "Set up"
  - clicking it opens the window
  - an invalid token shows the rejection message
  - Wi-Fi off shows the unreachable message
  - a valid token with stray spaces saves, the window closes and the count appears
  - `token.bin` does not contain the token in plain text
  - revoking the token on WaniKani and choosing "Refresh now" shows "Token invalid"

- [ ] **Step 4: Commit.** `git commit -m "feat: token setup window"`

---

### Task 8: Packaging and Start with Windows

**Files:**
- Modify: `package.json` (an electron-builder `build` block), `src/main/main.ts`
- Create: `build/icon.ico` (a simple blue square with a white "鰐" or "WK", 256 px)

**Interfaces:**
- Consumes: `Settings.startWithWindows` and the menu toggle from Task 6

- [ ] **Step 1: electron-builder config**

`appId: "local.wanikani.widget"`, `productName: "WaniKani Widget"`, `files: ["dist/**", "package.json"]`, `asarUnpack: ["node_modules/koffi/**"]`, `directories.output: "release"`, `win.target: "nsis"`, `nsis: { oneClick: true, perMachine: false }`.

- [ ] **Step 2: Login item**

When `app.isPackaged`, call `app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })` at startup and on each toggle. When unpackaged, the toggle only updates the settings.

- [ ] **Step 3: Build.** Run: `npm run dist`. Expected: `release/WaniKani Widget Setup <version>.exe` exists.

- [ ] **Step 4: Manual verification.** Install it from `release/`. Check each of these:
  - the tile appears
  - `Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run` lists the app
  - sign out and back in: the tile comes up on its own
  - unchecking "Start with Windows" removes the Run entry
  - starting the exe a second time doesn't create a second tile

- [ ] **Step 5: Run all tests and commit.** Run: `npm test`. Expected: all tests pass. Then `git commit -am "feat: packaging and start with Windows"`.
