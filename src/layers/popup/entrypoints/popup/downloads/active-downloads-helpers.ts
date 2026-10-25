import { describeActivity } from "@/lib/youtube/progress-label";
import { calculateWeightedProgress } from "@/lib/youtube/video-helpers";
import type { DownloadProgressEntry, DownloadType, Prettify, VideoDetail } from "@/types";

const PERCENT_COMPLETE = 100;

type StatusProgress = Record<string, DownloadProgressEntry>;
type VideoDetails = Record<string, VideoDetail>;

function computeWeightedFraction(entry: StatusProgress[string]) {
  return calculateWeightedProgress({
    isDownloading: entry.isDownloading,
    progress: entry.progress,
    progressType: entry.progressType
  }) / PERCENT_COMPLETE;
}

type GetProgressLabelParams = Prettify<{
  videoId: string;
  statusProgress: StatusProgress;
  downloadType: DownloadType;
}>;
// What the download is doing right now, in words; the percentage is shown beside it
export function getProgressLabel({ videoId, statusProgress, downloadType }: GetProgressLabelParams) {
  const progressEntry = statusProgress[videoId];
  if (!progressEntry) {
    return "";
  }

  return describeActivity({
    progressType: progressEntry.progressType,
    stage: progressEntry.stage,
    progress: progressEntry.progress,
    downloadType
  });
}

type GetProgressParams = Prettify<{
  videoId: string;
  statusProgress: StatusProgress;
}>;
export function getProgress({ videoId, statusProgress }: GetProgressParams) {
  const progressEntry = statusProgress[videoId];
  if (!progressEntry) {
    return null;
  }

  return computeWeightedFraction(progressEntry);
}

type VideoIdDetailsParams = Prettify<{
  videoId: string;
  videoDetails: VideoDetails;
}>;
export function getFilename({ videoId, videoDetails }: VideoIdDetailsParams) {
  return videoDetails[videoId]?.filenameOutput ?? videoId;
}

export function getQuality({ videoId, videoDetails }: VideoIdDetailsParams) {
  return videoDetails[videoId]?.quality ?? "";
}

function getDetail({ videoId, videoDetails }: VideoIdDetailsParams): VideoDetail | undefined {
  return videoDetails[videoId];
}

type GetProgressEntryParams = Prettify<{
  videoId: string;
  statusProgress: StatusProgress;
}>;
function getProgressEntry(
  { videoId, statusProgress }: GetProgressEntryParams
): DownloadProgressEntry | undefined {
  return statusProgress[videoId];
}

export const VideoStartState = {
  Starting: "starting",
  WaitingForFFmpeg: "waiting-for-ffmpeg",
  Queued: "queued"
} as const;

export type VideoStartState = (typeof VideoStartState)[keyof typeof VideoStartState];

type GetVideoStartStateParams = Prettify<{
  i: number;
  isFFmpegReady: boolean;
}>;
export function getVideoStartState({ i, isFFmpegReady }: GetVideoStartStateParams) {
  const isFirstItem = i === 0;
  if (isFirstItem) {
    return isFFmpegReady ? VideoStartState.Starting : VideoStartState.WaitingForFFmpeg;
  }

  return VideoStartState.Queued;
}

type BindDownloadAccessorsParams = Prettify<{
  statusProgress: StatusProgress;
  videoDetails: VideoDetails;
  getDownloadType: (videoId: string) => DownloadType;
}>;
export function bindDownloadAccessors({ statusProgress, videoDetails, getDownloadType }: BindDownloadAccessorsParams) {
  return {
    label: (id: string) => getProgressLabel({
      videoId: id,
      statusProgress,
      downloadType: getDownloadType(id)
    }),
    progress: (id: string) => getProgress({
      videoId: id,
      statusProgress
    }),
    filename: (id: string) => getFilename({
      videoId: id,
      videoDetails
    }),
    quality: (id: string) => getQuality({
      videoId: id,
      videoDetails
    }),
    detail: (id: string) => getDetail({
      videoId: id,
      videoDetails
    }),
    entry: (id: string) => getProgressEntry({
      videoId: id,
      statusProgress
    })
  };
}
