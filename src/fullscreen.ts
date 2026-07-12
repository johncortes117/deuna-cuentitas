// ═══════════════════════════════════════════════════════════════
// Cross-browser Fullscreen helpers (Android Chrome, Safari, etc.)
//
// Hard-won knowledge about Android Chrome + camera + fullscreen:
//
// If the camera starts (getUserMedia / QR scanner) while the page is in
// fullscreen, Chrome exits fullscreen VISUALLY but leaves
// `document.fullscreenElement` set — a "zombie" state that is IMPOSSIBLE
// to escape from JavaScript:
//   - exitFullscreen()'s promise hangs forever,
//   - re-requesting on the same element is a silent no-op (and consumes
//     the tap's transient user activation),
//   - any further request then fails with "TypeError: Permissions check
//     failed" because the activation was already consumed.
//
// Therefore the ONLY reliable strategy is PREVENTION: exit fullscreen
// cleanly BEFORE turning the camera on (see exitFullscreenSafe), and only
// re-enter after the camera has been fully released.
// ═══════════════════════════════════════════════════════════════

export function getFullscreenElement(): Element | null {
  const doc = document as any;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function requestFullscreenOn(target: Element): void {
  const el = target as any;
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (!fn) return;
  try {
    const result = fn.call(el);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch {
    // Ignore — fullscreen can be rejected by the browser (no activation, etc.)
  }
}

export function requestFullscreen(): void {
  requestFullscreenOn(document.documentElement);
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function exitFullscreen(): Promise<void> {
  if (!getFullscreenElement()) return Promise.resolve();
  const doc = document as any;
  const fn =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;
  if (!fn) return Promise.resolve();
  try {
    const result = fn.call(doc);
    if (result && typeof result.then === 'function') {
      return result.catch(() => {});
    }
  } catch {
    // Ignore
  }
  return Promise.resolve();
}

// Exit that can never hang: races the (possibly zombie) exit promise against
// a timeout. Returns true if the exit is known to have completed.
export function exitFullscreenSafe(timeoutMs = 400): Promise<boolean> {
  if (!getFullscreenElement()) return Promise.resolve(true);
  return Promise.race([
    exitFullscreen().then(() => true),
    delay(timeoutMs).then(() => false),
  ]);
}

// After the camera permission prompt (or the soft keyboard) the browser shows
// its own UI again, BUT `fullscreenElement` can stay set. The document
// *thinks* it is still fullscreen, so a plain re-request is a silent no-op
// and a "toggle" button wrongly calls exit.
// Detect *real* fullscreen by comparing the viewport to the physical screen.
export function isVisuallyFullscreen(): boolean {
  return window.innerHeight >= screen.height - 80;
}

// True while a QR scanner (and thus the camera) is mounted. Entering
// fullscreen with the camera on is what CREATES the zombie state, so all
// automatic fullscreen must pause while this is true.
export function isCameraActive(): boolean {
  return !!document.getElementById('mitimiti-qr-reader');
}

// Recover into fullscreen regardless of what state the document is in.
// Best effort: with a clean state (the normal case now that we exit before
// the camera starts) this is just a plain request; the layered fallbacks
// (exit stale state, then retry on <html>, then on <body>) remain for
// resilience against the zombie state described above.
export async function forceFullscreen(): Promise<void> {
  if (getFullscreenElement() && isVisuallyFullscreen()) return;

  if (getFullscreenElement()) {
    await exitFullscreenSafe(350);
    await delay(60);
  }

  requestFullscreen();
  await delay(350);

  // Requesting on a *different* element forces a fresh fullscreen transition
  // even when the browser still thinks it is already fullscreen.
  if (!isVisuallyFullscreen()) {
    requestFullscreenOn(document.body);
  }
}
