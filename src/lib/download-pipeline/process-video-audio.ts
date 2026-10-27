import {
  toUint8Array,
  reportProgress,
  toOwnedArrayBuffer,
  buildRecentContext,
  FFMPEG_PROGRESS_CAP
} from ".";
import { triggerDownloadFromFile } from "./blob-download";
import {
  buildAdditionalAudioTracks,
  buildSubtitleFiles,
  handleSingleStream,
  resolveDownloadFilename
} from "./build-mux-job";
import { runMuxVideoAudio } from "./ffmpeg-instance";
import { OPFS_MUX_OUTPUT_SUFFIX } from "./opfs-constants";
import { addToPlaylistBundle } from "./playlist-bundle";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { DownloadType, ProgressStage, ProgressType } from "@/types";
import type { Prettify, ProcessStreamData } from "@/types";

const log = createLogger(LogScope.Pipeline);

const DEFAULT_PLAYLIST_TITLE = "Playlist";
const MS_PER_SECOND = 1000;

type ProcessVideoAudioParams = Prettify<{
  item: ProcessStreamData;
  isCancelled: () => boolean;
}>;

type BuildSoundInputsParams = Prettify<{
  item: ProcessStreamData;
  audioData: Uint8Array | null;
}>;
// A video-only download carries no sound and no subtitles, so it muxes the video alone into the container
function buildSoundInputs({ item, audioData }: BuildSoundInputsParams) {
  if (item.type === DownloadType.Video) {
    return {
      subtitleTracks: [],
      additionalAudioTracks: [],
      audioTracks: []
    };
  }

  const additionalAudioTracks = buildAdditionalAudioTracks(item.additionalAudioStreams);
  return {
    subtitleTracks: item.subtitleTracks,
    additionalAudioTracks,
    audioTracks: [
      {
        data: toOwnedArrayBuffer(audioData!),
        label: item.primaryAudioLabel ?? "",
        languageCode: item.primaryAudioLanguageCode ?? ""
      },
      ...additionalAudioTracks
    ]
  };
}

export async function processVideoAudio({ item, isCancelled }: ProcessVideoAudioParams) {
  const {
    videoId, filenameOutput, videoMimeType, videoReencode, audioMimeType, tabId, defaultAudioTrackIndex
  } = item;

  const isVideoOnly = item.type === DownloadType.Video;
  const videoData = item.videoFile ? null : toUint8Array(item.videoData);
  const audioData = toUint8Array(item.audioData);
  const isVideoMissing = !videoData && !item.videoFile;
  const isMissingStream = isVideoMissing || (!audioData && !isVideoOnly);
  if (isMissingStream) {
    await handleSingleStream({
      item,
      videoData,
      audioData
    });
    return;
  }

  await reportProgress({
    videoId,
    progress: 0,
    progressType: ProgressType.FFmpeg,
    tabId
  });

  const { subtitleTracks, additionalAudioTracks, audioTracks } = buildSoundInputs({
    item,
    audioData
  });

  const downloadFilename = resolveDownloadFilename({
    filenameOutput,
    hasExtraTracks: additionalAudioTracks.length > 0
  });

  const videoStreamName = item.videoFile?.name;

  const muxStartedAt = Date.now();
  let outputFile: File;
  try {
    outputFile = await runMuxVideoAudio({
      videoId,
      job: {
        videoData: item.videoFile ? null : toOwnedArrayBuffer(videoData!),
        videoFile: item.videoFile,
        audioTracks,
        subtitleTracks: buildSubtitleFiles(subtitleTracks),
        videoMimeType,
        videoReencode,
        audioMimeType,
        videoId,
        tabId,
        defaultAudioTrackIndex: defaultAudioTrackIndex ?? 0,
        filenameOutput
      }
    });
  } finally {
    if (videoStreamName) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(videoStreamName).catch(() => {});
    }
  }

  log.info("Mux finished", {
    videoId,
    outputBytes: outputFile.size,
    seconds: Math.round((Date.now() - muxStartedAt) / MS_PER_SECOND)
  });
  const isDownloadCancelled = isCancelled();
  if (isDownloadCancelled) {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(videoId + OPFS_MUX_OUTPUT_SUFFIX).catch(() => {});
    return;
  }

  const isPlaylistItem = Boolean(item.playlistId);
  if (isPlaylistItem) {
    const data = new Uint8Array(await outputFile.arrayBuffer());
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(videoId + OPFS_MUX_OUTPUT_SUFFIX).catch(() => {});
    await addToPlaylistBundle({
      playlistId: item.playlistId!,
      playlistTitle: item.playlistTitle ?? DEFAULT_PLAYLIST_TITLE,
      totalCount: item.playlistTotalCount ?? 1,
      tabId,
      filename: downloadFilename,
      data,
      sourceUrl: item.sourceUrl
    });
    await reportProgress({
      videoId,
      progress: 1,
      progressType: ProgressType.FFmpeg,
      tabId
    });
    return;
  }

  await reportProgress({
    videoId,
    progress: FFMPEG_PROGRESS_CAP,
    progressType: ProgressType.FFmpeg,
    stage: ProgressStage.Saving,
    tabId
  });
  await triggerDownloadFromFile({
    file: outputFile,
    filenameOutput: downloadFilename,
    recentContext: buildRecentContext({
      item,
      extras: {
        videoMimeType,
        audioMimeType
      }
    }),
    async onRevoke() {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(videoId + OPFS_MUX_OUTPUT_SUFFIX).catch(() => {});
    }
  });
  await reportProgress({
    videoId,
    progress: 1,
    progressType: ProgressType.FFmpeg,
    tabId
  });
}
