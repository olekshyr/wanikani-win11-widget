declare global {
  interface Window {
    tokenApi: {
      save(raw: string): Promise<{ ok: true } | { ok: false; error: 'invalid' | 'unreachable' }>;
      openLink(): void;
    };
  }
}

const MESSAGES = {
  invalid: 'That token was rejected by WaniKani.',
  unreachable: "Couldn't reach WaniKani, try again.",
};

const form = document.getElementById('form') as HTMLFormElement;
const input = document.getElementById('token') as HTMLInputElement;
const button = document.getElementById('save') as HTMLButtonElement;
const error = document.getElementById('error')!;

document.getElementById('link')!.addEventListener('click', (e) => {
  e.preventDefault();
  window.tokenApi.openLink();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  button.disabled = true;
  error.textContent = '';
  const res = await window.tokenApi.save(input.value);
  button.disabled = false;
  if (!res.ok) error.textContent = MESSAGES[res.error];
});

export {};
