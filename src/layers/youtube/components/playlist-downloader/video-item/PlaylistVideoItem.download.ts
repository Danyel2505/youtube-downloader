import { batchCanceledIds, batchDownloadStatus, batchVideoIds } from "../PlaylistDownloader.batch.svelte";
import { CrossWorldMessage, crossWorldMessenger } from "@/lib/messaging/cross-world-messenger";
import { performCancelDownload } from "@/lib/ui/cancel-download";
import { CONTENT_OPTIONS } from "@/lib/ui/synced-stores.svelte";
import { resolveVideoFilename } from "@/lib/utils/containers";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { resolveDownloadType } from "@/lib/youtube/download-type";
import { filterVideoFormatsByEnhancedBitrate } from "@/lib/youtube/format-display";
import type { Prettify, VideoData } from "@/types";
import { cancelStreamTransfer } from "#youtube/entrypoints/youtube.content/download/stream-transfer";
import { checkedPlaylistVideos } from "#youtube/lib/ui/playlist-selection.svelte";

const log = createLogger(LogScope.Isolated);

type TriggerDownloadParams = Prettify<{
  videoData: VideoData;
  videoId: string;
  gridTitle: string | undefined;
  setLocallyDone: (value: boolean) => void;
}>;
export function triggerDownload({ videoData, videoId, gridTitle, setLocallyDone }: TriggerDownloadParams) {
  const options = CONTENT_OPTIONS;
  const downloadType = resolveDownloadType({
    preference: options.defaultDownloadType,
    isMusic: videoData.isMusic
  });

  const filenameOutput = resolveVideoFilename({
    videoData,
    options,
    downloadType,
    titleOverride: gridTitle
  });

  const videoCandidates = filterVideoFormatsByEnhancedBitrate(videoData.videoFormats, options.enhancedBitrate);

  const videoItag = videoCandidates[0]?.itag ?? 0;
  const audioItag = videoData.audioFormats[0]?.itag ?? 0;
  setLocallyDone(false);
  log.info("List download requested", {
    videoId,
    type: downloadType,
    videoItag,
    audioItag
  });
  crossWorldMessenger.sendMessage(CrossWorldMessage.DownloadRequest, {
    type: downloadType,
    videoId,
    videoItag,
    audioItag,
    filenameOutput,
    downloadExtras: options.downloadExtras,
    includeAutoDubbing: options.includeAutoDubbing
  }).catch(error => log.warn("List download request failed", videoId, error));
}

export function cancelDownload(videoId: string) {
  cancelStreamTransfer(videoId);
  performCancelDownload([videoId]).catch(() => {});

  const isPartOfActiveBatch = batchDownloadStatus.isRunning && batchVideoIds.has(videoId);
  if (isPartOfActiveBatch) {
    batchCanceledIds.add(videoId);
    checkedPlaylistVideos.delete(videoId);
  }
}
