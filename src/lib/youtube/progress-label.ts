import type { MessageKey } from "@/lib/i18n/es-419";
import { getLocale, t } from "@/lib/i18n/i18n.svelte.ts";
import { calculateConversionProgress } from "@/lib/youtube/download-progress";
import { DownloadType, ProgressStage, ProgressType, ReencodeEngine } from "@/types";

const STAGE_LABEL_KEYS = {
  [ProgressStage.Extracting]: "Preparing video for H.265",
  [ProgressStage.ReencodingGpu]: "Converting video to H.265 (GPU)",
  [ProgressStage.ReencodingCpu]: "Converting video to H.265 (CPU)",
  [ProgressStage.Merging]: "Merging video and audio",
  [ProgressStage.Saving]: "Saving the file"
} as const satisfies Record<ProgressStage, MessageKey>;

const ENGINE_BY_STAGE: Partial<Record<ProgressStage, ReencodeEngine>> = {
  [ProgressStage.ReencodingGpu]: ReencodeEngine.Gpu,
  [ProgressStage.ReencodingCpu]: ReencodeEngine.Cpu
};

const ENGINE_LABEL_KEYS = {
  [ReencodeEngine.Gpu]: "GPU",
  [ReencodeEngine.Cpu]: "CPU"
} as const satisfies Record<ReencodeEngine, MessageKey>;

const DOWNLOAD_LABEL_KEYS = {
  [DownloadType.VideoAndAudio]: "Downloading video and audio",
  [DownloadType.Video]: "Downloading video",
  [DownloadType.Audio]: "Downloading audio",
  [DownloadType.Auto]: "Downloading"
} as const satisfies Record<DownloadType, MessageKey>;

let percentFormatter: Intl.NumberFormat | null = null;
let percentFormatterLocale = "";

export function formatPercent(fraction: number) {
  const locale = getLocale();
  if (!percentFormatter || percentFormatterLocale !== locale) {
    percentFormatter = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0
    });
    percentFormatterLocale = locale;
  }

  return percentFormatter.format(fraction);
}

type DescribeActivityParams = {
  progressType: ProgressType | "";
  stage?: ProgressStage;
  progress: number;
  downloadType?: DownloadType;
};
// What the download is doing right now, in words, instead of a bare "Downloading"
export function describeActivity({ progressType, stage, progress, downloadType }: DescribeActivityParams) {
  if (stage) {
    return t(STAGE_LABEL_KEYS[stage]);
  }

  if (progressType === ProgressType.FFmpeg) {
    return t("Processing");
  }

  if (progressType === ProgressType.Zip) {
    return t("Building ZIP");
  }

  const isPreparing = progress <= 0;
  if (isPreparing) {
    return t("Preparing");
  }

  return t(DOWNLOAD_LABEL_KEYS[downloadType ?? DownloadType.Auto]);
}

type DescribeConversionParams = {
  stage: ProgressStage | undefined;
  progress: number;
};
// The second progress indicator: the H.265 conversion on its own, and the processor doing it
export function describeConversion({ stage, progress }: DescribeConversionParams) {
  const fraction = calculateConversionProgress({
    stage,
    progress
  });
  if (fraction === null) {
    return null;
  }

  const engine = stage && ENGINE_BY_STAGE[stage];
  return {
    fraction,
    label: t("H.265 conversion"),
    processor: engine ? t(ENGINE_LABEL_KEYS[engine]) : ""
  };
}
