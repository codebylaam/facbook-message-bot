import pino from "pino";

export type Logger = pino.Logger;

/**
 * One JSON line per event. Kept on a subpath export so the web bundle never
 * pulls pino in through the package root.
 */
export function createLogger(name: string, level = "info"): Logger {
  return pino({
    name,
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
