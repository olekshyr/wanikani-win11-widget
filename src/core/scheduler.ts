const HOUR_MS = 3_600_000;
const HOURLY_OFFSET_MS = 30_000;
const BURST_INTERVAL_MS = 10 * 60_000;
const BURST_COUNT = 6;
const OFFLINE_CHECK_MS = 5 * 60_000;
const QUICK_RETRY_MS = 30_000;

/** Milliseconds until the next HH:00:30 (UTC hours, which is when WaniKani releases reviews) strictly after now. */
export function msUntilNextHourlyCheck(now: Date): number {
  const sinceLast = (((now.getTime() - HOURLY_OFFSET_MS) % HOUR_MS) + HOUR_MS) % HOUR_MS;
  return HOUR_MS - sinceLast;
}

/** Concurrent calls while a run is in flight share that run instead of starting another. */
export function singleFlight(fn: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (!inFlight) inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export class RefreshScheduler {
  private hourly: ReturnType<typeof setTimeout> | null = null;
  private burst: ReturnType<typeof setInterval> | null = null;
  private offlineCheck: ReturnType<typeof setInterval> | null = null;
  private quickRetry: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly refresh: () => void, private readonly isOnline: () => boolean) {}

  start(): void {
    this.refresh();
    this.armHourly();
  }

  onDashboardOpened(): void {
    this.clearBurst();
    let remaining = BURST_COUNT;
    this.burst = setInterval(() => {
      this.refresh();
      if (--remaining === 0) this.clearBurst();
    }, BURST_INTERVAL_MS);
  }

  onResume(): void {
    this.refresh();
    this.armHourly();
  }

  /** The OS reported the network going up or down: re-check now instead of waiting for the next tick. */
  onNetworkChange(): void {
    this.refresh();
  }

  /**
   * While offline, check once after 30 s (the network is often still coming up right after login),
   * then every 5 minutes.
   */
  setOffline(offline: boolean): void {
    if (!offline) {
      if (this.offlineCheck) clearInterval(this.offlineCheck);
      if (this.quickRetry) clearTimeout(this.quickRetry);
      this.offlineCheck = null;
      this.quickRetry = null;
      return;
    }
    if (this.offlineCheck) return;
    const check = () => {
      if (this.isOnline()) this.refresh();
    };
    this.quickRetry = setTimeout(check, QUICK_RETRY_MS);
    this.offlineCheck = setInterval(check, OFFLINE_CHECK_MS);
  }

  stop(): void {
    if (this.hourly) clearTimeout(this.hourly);
    this.hourly = null;
    this.clearBurst();
    this.setOffline(false);
  }

  private armHourly(): void {
    if (this.hourly) clearTimeout(this.hourly);
    this.hourly = setTimeout(() => {
      this.refresh();
      this.armHourly();
    }, msUntilNextHourlyCheck(new Date()));
  }

  private clearBurst(): void {
    if (this.burst) clearInterval(this.burst);
    this.burst = null;
  }
}
