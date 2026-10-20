export const OPFS_MUX_OUTPUT_SUFFIX = "-mux-out";
export const OPFS_VIDEO_STREAM_SUFFIX = "-video-stream";
export const OPFS_REENCODE_IVF_SUFFIX = "-reencode-ivf";
export const OPFS_REENCODE_HEVC_SUFFIX = "-reencode-hevc";

const OPFS_WORKING_SUFFIXES = [
  OPFS_MUX_OUTPUT_SUFFIX,
  OPFS_VIDEO_STREAM_SUFFIX,
  OPFS_REENCODE_IVF_SUFFIX,
  OPFS_REENCODE_HEVC_SUFFIX
];

export async function sweepOrphanedOpfsFiles() {
  const root = await navigator.storage.getDirectory();
  const orphans = [];
  for await (const name of root.keys()) {
    const isWorkingFile = OPFS_WORKING_SUFFIXES.some(suffix => name.endsWith(suffix));
    if (isWorkingFile) {
      orphans.push(name);
    }
  }

  await Promise.all(orphans.map(name => root.removeEntry(name).catch(() => {})));
}
