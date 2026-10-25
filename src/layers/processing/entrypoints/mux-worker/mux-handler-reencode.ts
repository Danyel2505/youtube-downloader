import { buildInputArgs } from "./mux-ffmpeg-args";
import {
  reportFFmpegProgress,
  state,
  throwIfMuxCancelled,
  tryRmdir,
  tryUnmount
} from "./mux-state";
import { createOpfsOutputFs } from "./opfs-output-fs";
import { reencodeIvfToHevc } from "./reencode-hevc";
import { OPFS_REENCODE_HEVC_SUFFIX, OPFS_REENCODE_IVF_SUFFIX } from "@/lib/download-pipeline/opfs-constants";
import { ProgressStage } from "@/types";
import type { Prettify, VideoReencodeSpec } from "@/types";

const IVF_OUTPUT_FILENAME = "video.ivf";
const IVF_MOUNT_SUFFIX = "-ivf-out";
const DEMUX_PROGRESS_SHARE = 0.04;
const ENCODE_PROGRESS_SHARE = 0.86;

export const REENCODE_PROGRESS_SHARE = DEMUX_PROGRESS_SHARE + ENCODE_PROGRESS_SHARE;

type ExecIvfDemuxParams = Prettify<{
  sourceFilename: string;
  mountDirectory: string;
  syncHandle: FileSystemSyncAccessHandle;
}>;
function execIvfDemux({ sourceFilename, mountDirectory, syncHandle }: ExecIvfDemuxParams) {
  try {
    const exitCode = state.ffmpeg!.exec(
      ...buildInputArgs(sourceFilename),
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      "-an",
      "-sn",
      "-dn",
      "-f",
      "ivf",
      `${mountDirectory}/${IVF_OUTPUT_FILENAME}`
    );
    return {
      exitCode,
      outputBytes: syncHandle.getSize()
    };
  } finally {
    syncHandle.close();
    tryUnmount(mountDirectory);
    tryRmdir(mountDirectory);
  }
}

type DemuxToIvfParams = Prettify<{
  videoId: string;
  sourceFilename: string;
}>;
async function demuxToIvf({ videoId, sourceFilename }: DemuxToIvfParams) {
  const root = await navigator.storage.getDirectory();
  const ivfHandle = await root.getFileHandle(`${videoId}${OPFS_REENCODE_IVF_SUFFIX}`, { create: true });
  const syncHandle = await ivfHandle.createSyncAccessHandle();
  const mountDirectory = `/${videoId}${IVF_MOUNT_SUFFIX}`;
  const { FS } = state.ffmpeg!;
  FS.mkdir(mountDirectory);
  FS.mount(
    createOpfsOutputFs({
      fs: FS,
      syncHandle,
      outputFilename: IVF_OUTPUT_FILENAME
    }),
    {},
    mountDirectory
  );

  state.progressOffset = 0;
  state.progressScale = DEMUX_PROGRESS_SHARE;
  state.progressStage = ProgressStage.Extracting;
  reportFFmpegProgress(0);
  const { exitCode, outputBytes } = execIvfDemux({
    sourceFilename,
    mountDirectory,
    syncHandle
  });

  const isOutputMissing = outputBytes === 0;
  if (isOutputMissing) {
    throw new Error(`FFmpeg couldn't extract the video for H.265 (exit code ${exitCode})`);
  }

  return ivfHandle.getFile();
}

export async function removeReencodeFiles(videoId: string) {
  const root = await navigator.storage.getDirectory();
  await Promise.all(
    [OPFS_REENCODE_IVF_SUFFIX, OPFS_REENCODE_HEVC_SUFFIX].map(
      suffix => root.removeEntry(`${videoId}${suffix}`).catch(() => {})
    )
  );
}

type ReencodeVideoParams = Prettify<{
  videoId: string;
  sourceFilename: string;
  sourceMimeType: string;
  spec: VideoReencodeSpec;
}>;
// The stream as an H.265 elementary stream file, which the caller removes with removeReencodeFiles
export async function reencodeVideo({ videoId, sourceFilename, sourceMimeType, spec }: ReencodeVideoParams) {
  throwIfMuxCancelled(videoId);
  const ivfFile = await demuxToIvf({
    videoId,
    sourceFilename
  });

  const root = await navigator.storage.getDirectory();
  const hevcHandle = await root.getFileHandle(`${videoId}${OPFS_REENCODE_HEVC_SUFFIX}`, { create: true });
  const syncHandle = await hevcHandle.createSyncAccessHandle();
  state.progressStage = ProgressStage.Reencoding;
  reportFFmpegProgress(DEMUX_PROGRESS_SHARE);
  try {
    await reencodeIvfToHevc({
      ivfFile,
      sourceMimeType,
      spec,
      output: syncHandle,
      onProgress: fraction => reportFFmpegProgress(DEMUX_PROGRESS_SHARE + fraction * ENCODE_PROGRESS_SHARE),
      throwIfCancelled: () => throwIfMuxCancelled(videoId)
    });
  } finally {
    syncHandle.close();
    await root.removeEntry(`${videoId}${OPFS_REENCODE_IVF_SUFFIX}`).catch(() => {});
  }

  return hevcHandle.getFile();
}
