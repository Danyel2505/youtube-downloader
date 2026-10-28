import { cancelDownloadsLocally } from "../download/cancel-actions";
import { uncancelStreamTransfer } from "../download/stream-transfer";
import { CrossWorldMessage, crossWorldMessenger } from "@/lib/messaging/cross-world-messenger";
import { MessageType, sendMessage } from "@/lib/messaging/messaging";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { downloadRequestSchema } from "@/lib/youtube/schemas";

const log = createLogger(LogScope.Isolated);

export function registerDownloadProgressHandlers() {
  crossWorldMessenger.onMessage(CrossWorldMessage.CancelDownload, ({ data }) => {
    cancelDownloadsLocally(data.videoIds).catch(() => {});
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.StartBackgroundDownload, ({ data }) => {
    const parsed = downloadRequestSchema.safeParse(JSON.parse(data.requestJson));
    if (!parsed.success) {
      return;
    }

    sendMessage(MessageType.StartBackgroundDownload, parsed.data).catch(() => {});
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.AnnounceDownload, ({ data }) => {
    sendMessage(MessageType.AnnounceDownload, data).catch(() => {});
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.IframePlayerReady, async ({ data }) => {
    log.info("Iframe player ready, asking the background for the download", data.videoId);
    const request = await sendMessage(MessageType.DownloadIframeReady, { videoId: data.videoId });
    if (request) {
      await crossWorldMessenger.sendMessage(CrossWorldMessage.DownloadRequest, request);
    }
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.DownloadRequest, ({ data }) => {
    uncancelStreamTransfer(data.videoId);
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.AppendLog, ({ data }) => {
    sendMessage(MessageType.AppendLog, data).catch(() => {});
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.ReportPageProgress, ({ data }) => {
    sendMessage(MessageType.ReportPageProgress, data).catch(() => {});
  });

  crossWorldMessenger.onMessage(CrossWorldMessage.ReportMainDownloadFailed, ({ data }) => {
    sendMessage(MessageType.ReportWorkerDownloadFailed, {
      videoId: data.videoId,
      tabId: -1,
      isUnavailable: data.isUnavailable
    }).catch(() => {});
  });
}
