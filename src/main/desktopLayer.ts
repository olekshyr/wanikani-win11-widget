import type { BrowserWindow } from 'electron';
import koffi from 'koffi';

const GWLP_HWNDPARENT = -8;
const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x80;
const WS_EX_NOACTIVATE = 0x08000000;
const HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x1;
const SWP_NOMOVE = 0x2;
const SWP_NOACTIVATE = 0x10;

const user32 = koffi.load('user32.dll');
const FindWindowW = user32.func('intptr_t __stdcall FindWindowW(str16 cls, str16 name)');
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)');
const SetWindowLongPtrW = user32.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)');
const SetWindowPos = user32.func(
  'bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint flags)',
);

function hwndOf(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigUInt64LE(0);
}

/**
 * Makes the window an owned window of the desktop (Progman): it stays above the desktop icons, below every
 * normal window, out of Alt+Tab, and visible on Show desktop.
 */
export function attachToDesktop(win: BrowserWindow): void {
  const hwnd = hwndOf(win);
  const progman = FindWindowW('Progman', null);
  if (progman) SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, progman);
  const ex = BigInt(GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
  SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | BigInt(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE));
  sendToBottom(win);
}

export function sendToBottom(win: BrowserWindow): void {
  SetWindowPos(hwndOf(win), HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
}
