import { watchUncaughtErrors } from "./log-capture";
import { MessageType, sendMessage } from "@/lib/messaging/messaging";
import { setLogSink } from "@/lib/utils/logger";
import type { LogEntry, LogScope } from "@/lib/utils/logger";

export function sendLogToBackground(entry: LogEntry) {
  sendMessage(MessageType.AppendLog, entry).catch(() => {});
}

// The offscreen document (and the frames it hosts) can't read storage, so the background decides what to keep
export function forwardAllLogsToBackground(scope: LogScope) {
  watchUncaughtErrors(scope);
  setLogSink(sendLogToBackground);
}
