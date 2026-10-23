import { resolveAndDispatch } from "./download-execute";
import { crossWorldMessenger, CrossWorldMessage } from "@/lib/messaging/cross-world-messenger";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { rejectAfter } from "@/lib/utils/timeout";
import type { DownloadRequest } from "@/types";

const log = createLogger(LogScope.Main);

const DISPATCH_TIMEOUT_MS = 90_000;
const DISPATCH_TIMEOUT_MESSAGE = "Preparing the download took too long";

const activeDownloads = new Map<string, AbortController>();

export function cancelActiveDownload(videoId: string) {
  const controller = activeDownloads.get(videoId);
  if (controller) {
    controller.abort();
    activeDownloads.delete(videoId);
  }
}

export function cancelAllActiveDownloads() {
  const videoIds = [...activeDownloads.keys()];
  for (const controller of activeDownloads.values()) {
    controller.abort();
  }
  activeDownloads.clear();
  return videoIds;
}

export async function startDownload(params: Pick<DownloadRequest,
  "type" | "videoId" | "videoItag" | "audioItag" | "audioTrackId" | "codecPreferences" |
  "selectedCaptionVssId" | "filenameOutput" | "isIframeFallback" |
  "downloadExtras" | "includeAutoDubbing" |
  "playlistId" | "playlistTitle" | "playlistTotalCount" |
  "originTabId"
>) {
  const isIframeFallbackOnTop = params.isIframeFallback && self === top;
  if (isIframeFallbackOnTop) {
    return;
  }

  cancelActiveDownload(params.videoId);
  const abortController = new AbortController();
  activeDownloads.set(params.videoId, abortController);

  try {
    await rejectAfter({
      promise: resolveAndDispatch({
        params,
        abortSignal: abortController.signal
      }),
      milliseconds: DISPATCH_TIMEOUT_MS,
      message: DISPATCH_TIMEOUT_MESSAGE
    });
  } catch (error) {
    const isDispatchTimeout = error instanceof Error && error.message === DISPATCH_TIMEOUT_MESSAGE;
    if (isDispatchTimeout) {
      abortController.abort();
    }

    const isCancelledByUser = abortController.signal.aborted && !isDispatchTimeout;
    if (isCancelledByUser) {
      return;
    }

    log.warn("startDownload failed for", params.videoId, error);
    await crossWorldMessenger.sendMessage(
      CrossWorldMessage.ReportMainDownloadFailed,
      { videoId: params.videoId }
    );
  } finally {
    const isStillOwnController = activeDownloads.get(params.videoId) === abortController;
    if (isStillOwnController) {
      activeDownloads.delete(params.videoId);
    }
  }
}
