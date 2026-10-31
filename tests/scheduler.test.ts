import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { msUntilNextHourlyCheck, RefreshScheduler, singleFlight } from '../src/core/scheduler';

const MIN = 60_000;

describe('msUntilNextHourlyCheck', () => {
  test('just before :00:30 → until :00:30', () => {
    expect(msUntilNextHourlyCheck(new Date('2026-10-31T14:00:00Z'))).toBe(30_000);
  });
  test('exactly :00:30 → a full hour', () => {
    expect(msUntilNextHourlyCheck(new Date('2026-10-31T14:00:30Z'))).toBe(3_600_000);
  });
  test('14:59:59 → 31 s', () => {
    expect(msUntilNextHourlyCheck(new Date('2026-10-31T14:59:59Z'))).toBe(31_000);
  });
});

describe('RefreshScheduler', () => {
  let calls = 0;
  let online = true;
  let sched: RefreshScheduler;
  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  beforeEach(() => {
    vi.useFakeTimers();
    calls = 0;
    online = true;
    sched = new RefreshScheduler(() => { calls++; }, () => online);
  });
  afterEach(() => {
    sched.stop();
    vi.useRealTimers();
  });

  test('start refreshes now and then at each HH:00:30', () => {
    at('2026-10-31T14:20:00Z');
    sched.start();
    expect(calls).toBe(1);
    vi.advanceTimersByTime(40 * MIN + 30_000); // 15:00:30
    expect(calls).toBe(2);
    vi.advanceTimersByTime(60 * MIN); // 16:00:30
    expect(calls).toBe(3);
  });

  test('dashboard burst refreshes 6 times over the next hour', () => {
    at('2026-10-31T14:00:40Z');
    sched.start();
    vi.advanceTimersByTime(4 * MIN + 20_000); // 14:05
    sched.onDashboardOpened();
    vi.advanceTimersByTime(60 * MIN); // 15:05: 6 burst + 15:00:30 hourly
    expect(calls).toBe(1 + 7);
    vi.advanceTimersByTime(60 * MIN); // 16:05: only 16:00:30
    expect(calls).toBe(1 + 7 + 1);
  });

  test('opening the dashboard again restarts the burst', () => {
    at('2026-10-31T14:00:40Z');
    sched.start();
    vi.advanceTimersByTime(4 * MIN + 20_000); // 14:05
    sched.onDashboardOpened();
    vi.advanceTimersByTime(15 * MIN); // 14:20, burst fired at 14:15
    expect(calls).toBe(2);
    sched.onDashboardOpened();
    vi.advanceTimersByTime(60 * MIN); // 15:20: 6 burst (14:30..15:20) + 15:00:30
    expect(calls).toBe(2 + 7);
  });

  test('offline check refreshes only when the OS reports online, and stops when cleared', () => {
    at('2026-10-31T14:20:00Z');
    online = false;
    sched.start();
    sched.setOffline(true);
    vi.advanceTimersByTime(30 * MIN); // 14:50
    expect(calls).toBe(1);
    online = true;
    vi.advanceTimersByTime(5 * MIN); // 14:55
    expect(calls).toBe(2);
    sched.setOffline(false);
    vi.advanceTimersByTime(30 * MIN); // 15:25: only the 15:00:30 hourly
    expect(calls).toBe(3);
  });

  test('resume after sleeping across hours re-arms to the next real HH:00:30', () => {
    at('2026-10-31T14:20:00Z');
    sched.start();
    at('2026-10-31T18:42:00Z'); // clock jumped, timers did not run
    sched.onResume();
    expect(calls).toBe(2);
    vi.advanceTimersByTime(18 * MIN + 29_000); // 19:00:29
    expect(calls).toBe(2);
    vi.advanceTimersByTime(2_000); // 19:00:31
    expect(calls).toBe(3);
    vi.advanceTimersByTime(25 * MIN); // past where the stale 40m30s timer would fire
    expect(calls).toBe(3);
  });
});

describe('singleFlight', () => {
  test('concurrent calls share one run; later calls run again', async () => {
    let runs = 0;
    let release!: () => void;
    const fn = singleFlight(() => { runs++; return new Promise<void>((r) => { release = r; }); });
    const a = fn(); const b = fn(); const c = fn();
    expect(runs).toBe(1);
    release();
    await Promise.all([a, b, c]);
    const d = fn();
    expect(runs).toBe(2);
    release();
    await d;
  });
});
