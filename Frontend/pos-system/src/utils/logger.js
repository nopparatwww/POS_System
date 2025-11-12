// Frontend no-op logger to suppress console output in the browser.
// If you ever need to re-enable logs locally, flip ENABLE to true
// or gate by environment/localStorage as needed.

const ENABLE = false;

function passthrough(method) {
  if (!ENABLE) return () => {};
  return (...args) => {
    try {
      // eslint-disable-next-line no-console
      console[method](...args);
    } catch (_) {
      /* no-op */
    }
  };
}

export const logger = {
  log: passthrough("log"),
  warn: passthrough("warn"),
  error: passthrough("error"),
};

export default logger;
