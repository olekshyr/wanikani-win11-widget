# WaniKani Widget for Windows 11

A small tile on your Windows desktop that shows how many [WaniKani](https://www.wanikani.com) reviews are waiting. It sits behind your other windows like part of the wallpaper, so the count is always one glance (or one Win+D) away, and clicking it opens your [dashboard](https://www.wanikani.com/dashboard).

It starts with Windows, so the reminder to do your daily reviews is there without you having to remember to open anything.

## What the tile shows

| Tile | Meaning |
|---|---|
| Blue with a number | That many reviews are available right now. |
| Grey `0 reviews` | You're all caught up. |
| Dark `Offline` | Your computer has no internet connection. |
| Dimmed number | WaniKani couldn't be reached (server error); the last known count is shown. |
| Grey `Set up` | No API token yet. Click it to add one. |
| Grey `Token invalid` | WaniKani rejected the token (for example, it was revoked). Click it to enter a new one. |

## Install

Download `WaniKani-Widget-Setup-<version>.exe` from the [latest release](https://github.com/olekshyr/wanikani-win11-widget/releases/latest) and run it. It installs for your user only (no admin rights needed) and starts the widget.

The installer isn't code-signed, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway** to continue.

### Build it yourself

You need [Node.js](https://nodejs.org) 24 or newer.

```bash
git clone https://github.com/olekshyr/wanikani-win11-widget.git
cd wanikani-win11-widget
npm install
npm run dist
```

The installer is written to `release\WaniKani-Widget-Setup-<version>.exe`.

## First run: add your API token

1. Click the grey **Set up** tile.
2. Click **Create a token on WaniKani**, and create a personal access token. The default (read-only) permissions are enough.
3. Paste the token and click **Save**. The widget checks the token with WaniKani before saving it.

## Using it

- **Click** the tile to open the WaniKani dashboard in your default browser.
- **Right-click** the tile for the menu:
  - **Refresh now**: check WaniKani immediately.
  - **Unlock position**: the tile gets a dashed outline and you can drag it anywhere, including onto another monitor. Clicks don't open the dashboard while it's unlocked. Choose **Lock position** when you're done.
  - **Reset position**: move the tile back to the top-left corner.
  - **Change token…**: enter a different API token.
  - **Start with Windows**: start the widget when you sign in (on by default).
  - **Quit**

The tile's position and lock state are remembered between restarts.

## How often it checks

WaniKani releases new reviews at the top of each hour, so the widget doesn't poll constantly. It checks:

- when it starts,
- 30 seconds past every hour,
- when your computer wakes from sleep or the network connection changes,
- every 10 minutes for an hour after you click through to the dashboard, so the count drops as you do your reviews,
- when you choose **Refresh now**.

That's about 30 API calls a day. While offline it makes no API calls until Windows reports the network is back.

## Privacy

- The widget only talks to `api.wanikani.com`, using the [WaniKani API v2](https://docs.api.wanikani.com/20170710/) summary endpoint.
- Your token is encrypted with your Windows account (DPAPI, via Electron's `safeStorage`) and stored in `%APPDATA%\WaniKani Widget\token.bin`. It is never written in plain text.
- Settings (position, lock, start with Windows) are in `%APPDATA%\WaniKani Widget\settings.json`.

## Development

```bash
npm install
npm test        # unit tests (vitest)
npm start       # build and run the widget from source
npm run dist    # build the Windows installer into release/
```

The project is TypeScript on Electron:

- `src/core/`: plain TypeScript with no Electron dependency, and fully unit tested. It holds the review count, API client, tile state machine, refresh scheduler, settings, token store and position handling.
- `src/main/`: the Electron main process. It wires the core to the windows, the right-click menu, encrypted storage and power events. `desktopLayer.ts` uses [koffi](https://koffi.dev) to call Win32 so the tile is owned by the desktop: it stays behind normal windows, above the desktop icons, out of the taskbar and Alt+Tab, and visible on Win+D.
- `src/preload/`, `src/renderer/`: the tile and token windows.

The design notes and implementation plan are in [`docs/superpowers/`](docs/superpowers/).

## Known limitations

- Windows only (built and tested on Windows 11).
- The tile appears on one virtual desktop, not all of them.
- It can cover desktop icons in the spot where you place it.
- Uninstalling may leave the "Start with Windows" entry behind. To be safe, turn **Start with Windows** off before uninstalling, or remove the entry in Task Manager → Startup apps.
