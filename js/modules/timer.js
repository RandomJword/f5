// F5 Timer — wall-clock Date.now() based countdown
// Never uses setInterval counting. Survives tab switches via visibilitychange.

function createTimer(durationSeconds, onTick, onExpiry) {
  const totalMs = durationSeconds * 1000;
  const endTime = Date.now() + totalMs;
  let running = true;
  let rafId = null;

  function tick() {
    if (!running) return;

    const remaining = Math.max(0, endTime - Date.now());
    const seconds = Math.ceil(remaining / 1000);

    onTick({
      remaining,
      seconds,
      fraction: remaining / totalMs,
      isWarning: seconds <= 60 && seconds > 15,
      isCritical: seconds <= 15,
    });

    if (remaining <= 0) {
      running = false;
      onExpiry();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function onVisibilityChange() {
    if (!running) return;
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
    } else {
      // Tab visible again — wall clock is still correct, just restart ticking
      tick();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  tick();

  return {
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
    getRemaining() {
      return Math.max(0, endTime - Date.now());
    },
    isRunning() {
      return running;
    },
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export { createTimer, formatTime };
