import { emitToLogSink, LogLevel, setLogSink } from "@/lib/utils/logger";
import type { LogEntry, LogScope } from "@/lib/utils/logger";

export type LogSender = (entry: LogEntry) => void;

export function watchUncaughtErrors(scope: LogScope) {
  addEventListener("error", e => {
    emitToLogSink({
      scope,
      level: LogLevel.Error,
      args: ["Uncaught error:", e.error ?? e.message]
    });
  });
  addEventListener("unhandledrejection", e => {
    emitToLogSink({
      scope,
      level: LogLevel.Error,
      args: ["Unhandled rejection:", e.reason]
    });
  });
}

type CaptureLogsFromPageParams = {
  scope: LogScope;
  send: LogSender;
  isEnabled: () => boolean;
};
// The MAIN world has no storage access, so it follows the setting that ISOLATED pushes to it
export function captureLogsFromPage({ scope, send, isEnabled }: CaptureLogsFromPageParams) {
  watchUncaughtErrors(scope);
  setLogSink(entry => {
    if (isEnabled()) {
      send(entry);
    }
  });
}
