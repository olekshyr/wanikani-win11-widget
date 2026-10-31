# WaniKani Desktop Widget — Design

Date: 2026-10-31

## Intent

A small widget on the Windows desktop that shows how many WaniKani reviews are waiting right now. Its purpose is to keep that number in view so the user doesn't forget their daily practice. Clicking the widget opens https://www.wanikani.com/dashboard. It starts automatically when the user logs in to Windows.

## Goals

- The number of reviews available right now can be read at a glance from the desktop.
- One click opens the WaniKani dashboard.
- The widget runs on its own from Windows login and needs no attention after the first setup.
- The user can tell at a glance whether the computer is offline.

## Non-goals

- Lesson counts, upcoming-review forecasts, levels, or any other statistics.
- Doing reviews inside the widget.
- Desktop notifications or toasts.
- macOS or Linux support.
- A settings window beyond the token-entry window.

## Anti-goals (the widget fails if it does these, even if it technically works)

- It covers or interrupts the user's work. It must stay **behind** all normal windows.
- It shows an old count as though it were current while the computer is offline.
- It shows up in the taskbar or Alt+Tab.
- It stores the API token in plain text.

## Decisions made by the user

- **Language:** TypeScript.
- **Visual style:** "Big number tile," chosen from three mockups. It is a square tile in WaniKani blue (`#00aaff`), about 110×110 px, with rounded corners and a soft shadow. A large review count (about 40 px, white, bold) sits in the middle, with the word "reviews" under it. The whole tile is the button.
- **Placement:** the top-left corner of the desktop by default.
- **Z-order:** the widget sits behind every other window, like part of the wallpaper.
- **Offline:** when the computer is offline, the tile shows its own **"Offline"** state. It does not keep showing the last count.
- **Dragging:** the position can be unlocked, the tile dragged anywhere, and the position locked again (details below).
- **Desktop icons:** the tile may sit **above** desktop icons and cover any that are under it. It sits at the bottom of the normal window stack, not in the wallpaper layer, so click, right-click and drag always work.
- **Virtual desktops:** the tile only needs to appear on one Windows virtual desktop. No pinning across desktops.

## Decisions made by Claude (the user heard these and did not object)

- **Framework:** Electron, because Node 24 is installed and the user wanted TypeScript. The user was told this means roughly 80–150 MB of RAM.
- **Token storage:** the user's WaniKani personal API token is encrypted with Electron's `safeStorage` (DPAPI, tied to the Windows account) and saved in the app's userData folder.
- **Show desktop (Win+D):** the tile stays visible when the user shows the desktop or minimises all windows. It never shows in the taskbar or Alt+Tab.
- **Control menu:** right-clicking the tile opens a context menu:
  - Refresh now
  - Unlock position / Lock position (one item whose label toggles)
  - Change token…
  - Start with Windows (checkbox)
  - Quit

## Behaviour

### Review count

- Data comes from `GET https://api.wanikani.com/v2/summary` with the headers `Authorization: Bearer <token>` and `Wanikani-Revision: 20170710`.
- The count is the total number of `subject_ids` across every entry in `data.reviews` whose `available_at` is at or before the current time. The first entry usually covers the current hour, but summing over all past-due entries is more robust.

### Refresh schedule

The count only changes in two ways: new reviews arrive at the top of an hour, or the user finishes reviews on the website. Polling follows those two events and does nothing else (the user asked for few calls):

- Fetch once on startup.
- Fetch just after each top of the hour, at about HH:00:30. That is about 24 calls a day.
- Fetch when the computer wakes from sleep and when the network comes back, because a top-of-hour fetch may have been missed.
- Fetch on the "Refresh now" menu item.
- After the tile is clicked to open the dashboard, fetch every 10 minutes for the next hour (6 calls), so the count drops after the user does reviews.
- There is no fixed short-interval polling. While offline, check connectivity with OS network events. If those aren't reliable, use at most one lightweight check every 5 minutes, and don't send API calls that are certain to fail.

### Tile states

| State | When | Looks like |
|---|---|---|
| Setup | No token is saved | Neutral/grey tile showing "Set up". Clicking opens the token window. |
| Loading | First fetch after start, before any result | Blue tile showing "…" |
| Reviews waiting | Count > 0 | Blue tile with the count and "reviews" |
| All done | Count = 0 | Calm grey tile showing "0 reviews" |
| Offline | A network-level failure (DNS failure, connection refused or timed out, no network) | A distinct dark/grey tile with an "Offline" label and an offline icon. No count is shown. |
| Token invalid | The API returns 401 | Tile showing "Token invalid". Clicking opens the token window. |
| API error | An HTTP 5xx, a 429, or a malformed response while online | Keeps the last known count, dimmed to about 50% opacity. If there is no earlier count, shows "…" dimmed. Retries on the normal schedule. (Claude's call for the no-earlier-count case.) |

Clicking the tile opens the dashboard in the default browser (`shell.openExternal`) only in the "Reviews waiting", "All done", "Offline", and "API error" states, and only while the position is **locked**. In "Setup" and "Token invalid", clicking opens the token window instead.

### Dragging and locking

- The tile starts **locked**, at the top-left of the primary monitor's work area with a small margin (about 16 px).
- **Unlocked:** the tile gets a dashed outline, the cursor becomes a move cursor, and the user can drag the tile anywhere, including onto other monitors. Clicking does not open the dashboard.
- **Locked:** the outline goes away, the tile can't be moved, and clicking works as normal.
- The position and the lock state are saved and restored on the next launch.
- On launch, if the saved position is no longer on any connected display, the tile moves back to the default top-left position.

### Token window

- A small, ordinary, focused window with a short explanation, a link to https://www.wanikani.com/settings/personal_access_tokens, a password-style text field, and a Save button.
- Save checks the token by calling `/v2/summary`, or `/v2/user` if it's simpler to call. If the API returns 401, the window shows an inline error and doesn't close. On a network error or 5xx, it shows a different inline error ("Couldn't reach WaniKani, try again") and doesn't save the token (Claude's call). If the call succeeds, it saves the encrypted token, closes the window, and refreshes the tile.
- A token with default read-only permissions is enough.

### Startup

- "Start with Windows" defaults to **on**, and it is toggled from the context menu.
- Only one instance runs at a time (single-instance lock).

## Constraints

- The target machine is Windows 11 with Node 24.15 and npm 11.12.
- There is no Rust toolchain, so Tauri is ruled out.
- The folder is not a git repository yet.

## Left to the builder

- **Keeping the tile behind all windows and visible on Show desktop.** Normal Electron windows don't do this on their own. It must sit above the desktop icons (not in the WorkerW wallpaper layer) and must allow click, right-click, and drag. One approach: make the window an owned/child window of Progman, or keep it at the bottom with `SetWindowPos(HWND_BOTTOM)` plus `WS_EX_NOACTIVATE`/`WS_EX_TOOLWINDOW`, through FFI (for example `koffi`).
- How offline is detected, as long as offline and API errors end up as separate states.
- Project layout, build tooling, and packaging (for example `electron-builder` or `electron-forge`). The result must be a single command that builds a runnable Windows executable for "Start with Windows" to point at.
- Exact fonts, the offline icon, and how the dashed outline looks, within the visual direction above.
- Tests: unit tests for the count calculation and the state selection logic at minimum.
