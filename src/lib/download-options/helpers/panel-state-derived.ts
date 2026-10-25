import { PrimaryButtonState } from "@/lib/ui/primary-button.svelte";
import { CONTENT_OPTIONS } from "@/lib/ui/synced-stores.svelte";
import { resolveMultiTrackExtension } from "@/lib/utils/containers";
import { resolveOutputExtensionForFormats } from "@/lib/youtube/align-formats-to-container";
import { isAudioTrackInLanguages } from "@/lib/youtube/audio-format-helpers";
import { AUTO_DUB_TRACK_SUFFIX } from "@/lib/youtube/download-plan";
import { formatAudioQualityLabel, formatVideoQualityLabel } from "@/lib/youtube/video-helpers";
import { DownloadType, type AdaptiveFormatItem, type CodecPreferences, type VideoData } from "@/types";

type MultiTrackParams = {
  selectedAudioFormat: AdaptiveFormatItem | null;
  getVideoData: () => VideoData;
  downloadExtras: boolean;
};
function isMultiTrackDownload({ selectedAudioFormat, getVideoData, downloadExtras }: MultiTrackParams) {
  const selectedTrackId = selectedAudioFormat?.audioTrack?.id;
  const isTrackWithExtras = selectedTrackId && downloadExtras;
  if (!isTrackWithExtras) {
    return false;
  }

  const isSelectedAutoDubbed = selectedTrackId.endsWith(AUTO_DUB_TRACK_SUFFIX);
  const isAutoDubbingBlockedForSelected = !CONTENT_OPTIONS.includeAutoDubbing && isSelectedAutoDubbed;
  return !isAutoDubbingBlockedForSelected
    && getVideoData().audioFormats.some(format => {
      const trackId = format.audioTrack?.id;
      return trackId
        && trackId !== selectedTrackId
        && (CONTENT_OPTIONS.includeAutoDubbing || !trackId.endsWith(AUTO_DUB_TRACK_SUFFIX))
        && isAudioTrackInLanguages({
          trackId,
          languages: CONTENT_OPTIONS.audioLanguages
        });
    });
}

// The container the codec menus are measured against: what the user picked, so the menus don't
// shrink or grow when a picked codec makes the download switch to MKV
export function resolveMenuExtension({ extension, ...multiTrackParams }: MultiTrackParams & { extension: string }) {
  return isMultiTrackDownload(multiTrackParams) ? resolveMultiTrackExtension(extension) : extension;
}

export function resolveActualExtension({
  downloadType,
  selectedVideoFormat,
  selectedAudioFormat,
  extension,
  getVideoData,
  downloadExtras,
  codecPreferences
}: {
  downloadType: DownloadType;
  selectedVideoFormat: AdaptiveFormatItem | null;
  selectedAudioFormat: AdaptiveFormatItem | null;
  extension: string;
  getVideoData: () => VideoData;
  downloadExtras: boolean;
  codecPreferences: CodecPreferences;
}) {
  const isAudioOrMissingFormat = downloadType === DownloadType.Audio || !selectedVideoFormat || !selectedAudioFormat;
  if (isAudioOrMissingFormat) {
    return extension;
  }

  const baseExtension = resolveOutputExtensionForFormats({
    videoData: getVideoData(),
    videoFormat: selectedVideoFormat,
    audioFormat: selectedAudioFormat,
    userExtension: extension,
    codecPreferences
  });

  const isMultiTrack = isMultiTrackDownload({
    selectedAudioFormat,
    getVideoData,
    downloadExtras
  });
  return isMultiTrack ? resolveMultiTrackExtension(baseExtension) : baseExtension;
}

export function resolvePrimaryState({
  isDownloading,
  isFailed,
  isInterrupted,
  isDone
}: {
  isDownloading: boolean;
  isFailed: boolean;
  isInterrupted: boolean;
  isDone: boolean;
}) {
  if (isDownloading) {
    return PrimaryButtonState.Downloading;
  }

  if (isFailed) {
    return PrimaryButtonState.Failed;
  }

  if (isInterrupted) {
    return PrimaryButtonState.Interrupted;
  }

  if (isDone) {
    return PrimaryButtonState.Done;
  }

  return PrimaryButtonState.Idle;
}

export function resolveQualityLabel({
  downloadType,
  selectedVideoFormat,
  selectedAudioFormat
}: {
  downloadType: DownloadType;
  selectedVideoFormat: AdaptiveFormatItem | null;
  selectedAudioFormat: AdaptiveFormatItem | null;
}) {
  const isAudioType = downloadType === DownloadType.Audio;
  if (isAudioType) {
    return selectedAudioFormat ? formatAudioQualityLabel(selectedAudioFormat) : "";
  }

  return selectedVideoFormat ? formatVideoQualityLabel(selectedVideoFormat) : "";
}
