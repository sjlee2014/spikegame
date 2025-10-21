// Throttle function - limits function calls to once per interval
export function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  };
}

// Throttle with trailing call - ensures the last call is always executed
export function throttleWithTrailing(func, delay) {
  let lastCall = 0;
  let timeoutId = null;

  return function (...args) {
    const now = Date.now();

    // Clear any pending trailing call
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // If enough time has passed, call immediately
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }

    // Schedule a trailing call
    const remainingTime = delay - (now - lastCall);
    timeoutId = setTimeout(() => {
      lastCall = Date.now();
      func(...args);
      timeoutId = null;
    }, remainingTime);
  };
}
