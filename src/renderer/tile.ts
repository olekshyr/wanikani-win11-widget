interface TileView {
  main: string;
  sub: string;
  tone: 'blue' | 'grey' | 'dark';
  dimmed: boolean;
  offlineIcon: boolean;
  unlocked: boolean;
}

declare global {
  interface Window {
    tile: {
      onView(cb: (v: TileView) => void): void;
      click(): void;
      contextMenu(): void;
      moveTo(p: { x: number; y: number }): void;
      dragEnd(): void;
      online(): void;
      ready(): void;
    };
  }
}

const tile = document.getElementById('tile')!;
const main = document.getElementById('main')!;
const sub = document.getElementById('sub')!;
let unlocked = false;

window.tile.onView((v) => {
  unlocked = v.unlocked;
  main.textContent = v.main;
  main.classList.toggle('long', v.main.length > 3);
  sub.textContent = v.sub;
  sub.style.display = v.sub ? '' : 'none';
  tile.className = ['tile', v.tone, v.dimmed && 'dimmed', v.offlineIcon && 'offline', v.unlocked && 'unlocked']
    .filter(Boolean)
    .join(' ');
});

let drag: { ox: number; oy: number } | null = null;

tile.addEventListener('pointerdown', (e) => {
  if (!unlocked || e.button !== 0) return;
  drag = { ox: e.screenX - window.screenX, oy: e.screenY - window.screenY };
  tile.setPointerCapture(e.pointerId);
});

tile.addEventListener('pointermove', (e) => {
  if (drag) window.tile.moveTo({ x: e.screenX - drag.ox, y: e.screenY - drag.oy });
});

tile.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  window.tile.dragEnd();
});

tile.addEventListener('click', () => {
  if (!unlocked) window.tile.click();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.tile.contextMenu();
});

window.addEventListener('online', () => window.tile.online());

window.tile.ready();

export {};
