import type { ProgressStage, ProgressType } from "@/types";
import type { Prettify } from "@/types";

export type ButtonViewState = Prettify<{
  isDownloading: boolean;
  isDone: boolean;
  isInterrupted: boolean;
  isError: boolean;
  isUnavailable: boolean;
  isPanelOpen: boolean;
  isPanelBelow: boolean;
  downloadProgress: string;
  isProgressNonZero: boolean;
  progressType: ProgressType | "";
  stage?: ProgressStage;
  filename: string;
  quality: string;
  isDownloadable: boolean;
}>;

export const WatchButtonLayout = {
  Watch: "watch",
  Shorts: "shorts"
} as const;

export type WatchButtonLayout = (typeof WatchButtonLayout)[keyof typeof WatchButtonLayout];
