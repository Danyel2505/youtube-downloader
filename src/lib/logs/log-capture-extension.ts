import { watchUncaughtErrors } from "./log-capture";
import type { LogSender } from "./log-capture";
import { sendLogToBackground } from "./log-forward";
import { optionsItem } from "@/lib/storage/storage";
import { setLogSink } from "@/lib/utils/logger";
import type { LogScope } from "@/lib/utils/logger";
import type { Options } from "@/types";

type CaptureLogsWhileEnabledParams = {
  scope: LogScope;
  send: LogSender;
};
// Contexts with storage access follow the setting directly, so nothing is formatted or sent while it's off
export async function captureLogsWhileEnabled({ scope, send }: CaptureLogsWhileEnabledParams) {
  watchUncaughtErrors(scope);
  function applyOptions(options: Partial<Options> | null) {
    setLogSink(options?.isLogsEnabled ? send : null);
  }

  applyOptions(await optionsItem.getValue());
  optionsItem.watch(applyOptions);
}

// Everything except the background hands its entries over, since the background owns the single persisted log
export function forwardLogsToBackground(scope: LogScope) {
  return captureLogsWhileEnabled({
    scope,
    send: sendLogToBackground
  });
}
