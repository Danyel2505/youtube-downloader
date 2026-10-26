import { ProgressStage, ProgressType, ReencodeEngine } from "@/types";
import type { Prettify } from "@/types";

const DOWNLOAD_PHASE_WEIGHT = 70;
const MUX_PHASE_WEIGHT = 30;
const MIN_VISIBLE_PERCENT = 0.5;

export const CAPTION_ESTIMATED_BYTES = 50_000;

// The H.265 conversion's slice of the processing phase: the rest is the final merge
export const DEMUX_PROGRESS_SHARE = 0.04;
export const ENCODE_PROGRESS_SHARE = 0.86;
export const REENCODE_PROGRESS_SHARE = DEMUX_PROGRESS_SHARE + ENCODE_PROGRESS_SHARE;

export const REENCODE_STAGE_BY_ENGINE = {
  [ReencodeEngine.Gpu]: ProgressStage.ReencodingGpu,
  [ReencodeEngine.Cpu]: ProgressStage.ReencodingCpu
} as const;

const CONVERSION_STAGES: ReadonlySet<ProgressStage> = new Set([
  ProgressStage.Extracting,
  ProgressStage.ReencodingGpu,
  ProgressStage.ReencodingCpu
]);

type CalculateConversionProgressParams = Prettify<{
  stage: ProgressStage | undefined;
  progress: number;
}>;
// The H.265 conversion's own 0-1 progress, null while nothing is being converted
export function calculateConversionProgress({ stage, progress }: CalculateConversionProgressParams) {
  if (!stage || !CONVERSION_STAGES.has(stage)) {
    return null;
  }

  return Math.min(progress / REENCODE_PROGRESS_SHARE, 1);
}

type CalculateWeightedProgressParams = Prettify<{
  isDownloading: boolean;
  progress: number;
  progressType: ProgressType | "";
}>;
export function calculateWeightedProgress({ isDownloading, progress, progressType }: CalculateWeightedProgressParams) {
  if (!isDownloading) {
    return 0;
  }

  const isMuxProgress = progressType === ProgressType.FFmpeg;
  const weighted = isMuxProgress
    ? DOWNLOAD_PHASE_WEIGHT + progress * MUX_PHASE_WEIGHT
    : progress * DOWNLOAD_PHASE_WEIGHT;

  const hasProgress = progress > 0;
  const isBelowVisibleFloor = weighted < MIN_VISIBLE_PERCENT;
  if (hasProgress && isBelowVisibleFloor) {
    return MIN_VISIBLE_PERCENT;
  }

  return weighted;
}
