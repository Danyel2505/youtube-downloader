import { executeMuxPhases, tryCheckOutput } from "./mux-handler-exec";
import { cleanupMuxFiles, writeMuxInputFiles } from "./mux-handler-files";
import { reencodeVideo, removeReencodeFiles } from "./mux-handler-reencode";
import {
  postFileResult,
  reportFFmpegProgress,
  state,
  tryRmdir,
  tryUnmount
} from "./mux-state";
import { cleanupOpfsOutput, createOpfsOutputFs, createOpfsOutputHandle } from "./opfs-output-fs";
import type { MuxVideoAudioJob } from "@/lib/download-pipeline/mux-worker-types";
import {
  getCompatibleFilename,
  getVideoTempExtension,
  isVideoNativeForContainer,
  resolveMultiTrackExtension
} from "@/lib/utils/containers";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { REENCODE_PROGRESS_SHARE } from "@/lib/youtube/download-progress";
import { ProgressStage } from "@/types";

const log = createLogger(LogScope.Ffmpeg);

const WORKERFS_MOUNT_SUFFIX = "-opfs-in";
const REENCODED_MOUNT_SUFFIX = "-reencoded-in";
const OPFS_OUT_SUFFIX = "-opfs-out";
const MKV_EXTENSION = "mkv";
const VIDEO_TEMP_SUFFIX = "video";

function logMuxJob({ job, targetExtension }: {
  job: MuxVideoAudioJob;
  targetExtension: string;
}) {
  log.info("Mux job", {
    videoId: job.videoId,
    targetExtension,
    isReencode: !!job.videoReencode,
    audioTracks: job.audioTracks.length,
    subtitleTracks: job.subtitleTracks.length,
    videoBytes: job.videoFile?.size ?? job.videoData?.byteLength
  });
}

export async function handleMuxVideoAudio(job: MuxVideoAudioJob) {
  const {
    videoData, videoFile, audioTracks, subtitleTracks, videoReencode,
    videoMimeType: sourceVideoMimeType, audioMimeType, videoId, tabId,
    defaultAudioTrackIndex, filenameOutput
  } = job;
  state.currentVideoId = videoId;
  state.currentTabId = tabId;
  state.cancelledVideoIds.delete(videoId);

  const videoMimeType = videoReencode?.mimeType ?? sourceVideoMimeType;
  const isMultiTrack = audioTracks.length > 1;
  const filenameBase = filenameOutput.replace(/\.[^.]+$/, "");
  const existingExtension = filenameOutput.split(".").pop() ?? MKV_EXTENSION;
  const targetExtension = isMultiTrack ? resolveMultiTrackExtension(existingExtension) : existingExtension;
  const muxFilename = getCompatibleFilename(`${videoId}-mux.${MKV_EXTENSION}`);
  const isMkv = targetExtension === MKV_EXTENSION;
  const outputFilename = isMkv
    ? muxFilename
    : getCompatibleFilename(`${videoId}-${filenameBase}.${targetExtension}`);
  const isNonNativeContainer = !isVideoNativeForContainer({
    videoMimeType,
    targetExtension
  });
  const useIntermediateMkv = !isMkv && isNonNativeContainer;

  logMuxJob({
    job,
    targetExtension
  });

  const isWorkerfsVideo = !!videoFile;
  const workerfsDir = `/${videoId}${WORKERFS_MOUNT_SUFFIX}`;

  let videoFilename: string;
  if (isWorkerfsVideo) {
    state.ffmpeg!.FS.mkdir(workerfsDir);
    state.ffmpeg!.FS.mount(state.ffmpeg!.FS.filesystems.WORKERFS, { files: [videoFile] }, workerfsDir);
    videoFilename = `${workerfsDir}/${videoFile.name}`;
  } else {
    videoFilename = `${videoId}-${VIDEO_TEMP_SUFFIX}.${getVideoTempExtension(sourceVideoMimeType)}`;
  }

  state.progressOffset = 0;
  state.progressScale = useIntermediateMkv ? 0.5 : 1;
  state.progressStage = ProgressStage.Merging;

  const { audioFilenames, subtitleFilenames } = writeMuxInputFiles({
    videoId,
    videoFilename,
    videoData: videoData ?? new ArrayBuffer(0),
    skipVideoWrite: isWorkerfsVideo,
    audioTracks,
    audioMimeType,
    subtitleTracks
  });

  const outputHandle = await createOpfsOutputHandle(videoId);
  const syncHandle = await outputHandle.createSyncAccessHandle();
  const opfsOutDir = `/${videoId}${OPFS_OUT_SUFFIX}`;
  const outputDriver = createOpfsOutputFs({
    fs: state.ffmpeg!.FS,
    syncHandle,
    outputFilename
  });
  state.ffmpeg!.FS.mkdir(opfsOutDir);
  state.ffmpeg!.FS.mount(outputDriver, {}, opfsOutDir);
  const opfsOutputFilename = `${opfsOutDir}/${outputFilename}`;

  const reencodedDir = `/${videoId}${REENCODED_MOUNT_SUFFIX}`;
  let isReencodedMounted = false;
  let success: boolean | undefined;
  try {
    let muxVideoFilename = videoFilename;
    if (videoReencode) {
      const reencodedFile = await reencodeVideo({
        videoId,
        sourceFilename: videoFilename,
        sourceMimeType: sourceVideoMimeType,
        spec: videoReencode
      });
      state.ffmpeg!.FS.mkdir(reencodedDir);
      state.ffmpeg!.FS.mount(state.ffmpeg!.FS.filesystems.WORKERFS, { files: [reencodedFile] }, reencodedDir);
      isReencodedMounted = true;
      muxVideoFilename = `${reencodedDir}/${reencodedFile.name}`;
      state.progressOffset = REENCODE_PROGRESS_SHARE;
      state.progressScale = 1 - REENCODE_PROGRESS_SHARE;
      state.progressStage = ProgressStage.Merging;
      reportFFmpegProgress(REENCODE_PROGRESS_SHARE);
    }

    success = executeMuxPhases({
      params: {
        videoFilename: muxVideoFilename,
        videoMimeType,
        videoFrameRate: videoReencode?.frameRate,
        audioFilenames,
        subtitleFilenames,
        outputFilename: opfsOutputFilename,
        muxFilename,
        useIntermediateMkv,
        audioMimeType,
        targetExtension,
        audioTracks,
        subtitleTracks,
        defaultAudioTrackIndex
      },
      checkOutput: filename => filename === opfsOutputFilename
        ? syncHandle.getSize() > 0
        : tryCheckOutput(filename)
    });
  } finally {
    syncHandle.close();
    tryUnmount(opfsOutDir);
    tryRmdir(opfsOutDir);
    cleanupMuxFiles({
      videoFilename,
      audioFilenames,
      subtitleFilenames,
      muxFilename,
      outputFilename,
      useIntermediateMkv,
      targetExtension
    });

    if (isWorkerfsVideo) {
      tryUnmount(workerfsDir);
      tryRmdir(workerfsDir);
    }

    if (isReencodedMounted) {
      tryUnmount(reencodedDir);
      tryRmdir(reencodedDir);
    }

    if (videoReencode) {
      await removeReencodeFiles(videoId);
    }

    if (!success) {
      await cleanupOpfsOutput(videoId);
    }
  }

  if (success) {
    const file = await outputHandle.getFile();
    postFileResult(file);
  }
}
