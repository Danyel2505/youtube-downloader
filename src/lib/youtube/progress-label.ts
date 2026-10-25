import type { MessageKey } from "@/lib/i18n/es-419";
import { getLocale, t } from "@/lib/i18n/i18n.svelte.ts";
import { DownloadType, ProgressStage, ProgressType } from "@/types";

const STAGE_LABEL_KEYS = {
  [ProgressStage.Extracting]: "Preparing video for H.265",
  [ProgressStage.Reencoding]: "Converting video to H.265",
  [ProgressStage.Merging]: "Merging video and audio",
  [ProgressStage.Saving]: "Saving the file"
} as const satisfies Record<ProgressStage, MessageKey>;

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
