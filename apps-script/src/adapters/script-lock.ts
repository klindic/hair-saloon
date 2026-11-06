import type { Lock } from '../domain/booking';

/**
 * The `Lock` port, backed by `LockService.getScriptLock()`. Stores a reference only when
 * `tryLock` actually succeeds, so `release()` is a safe no-op if no lock was ever acquired - this
 * is a second safety net independent of `bookSlot`'s own conditional: `bookSlot` never calls
 * `release()` when `tryAcquire` returns false, and this class ensures that even if it did, the
 * call would be a no-op rather than releasing someone else's lock.
 */
export class ScriptLock implements Lock {
  private lock: GoogleAppsScript.Lock.Lock | null = null;

  tryAcquire(timeoutMs: number): boolean {
    const lock = LockService.getScriptLock();
    const acquired = lock.tryLock(timeoutMs);
    if (acquired) {
      this.lock = lock;
    }
    return acquired;
  }

  release(): void {
    if (this.lock !== null) {
      this.lock.releaseLock();
      this.lock = null;
    }
  }
}
