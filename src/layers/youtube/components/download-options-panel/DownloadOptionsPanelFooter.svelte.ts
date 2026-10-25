import { describeActivity, formatPercent } from "@/lib/youtube/progress-label";
import type { DownloadType, ProgressStage, ProgressType, Prettify } from "@/types";
import {
  attachPrimaryButton as attachPrimaryButtonElement,
  PrimaryButtonState
} from "#youtube/lib/ui/panel-button-attachments.svelte";

export { PrimaryButtonState };

export type FooterParams = Prettify<{
  readonly primaryState: PrimaryButtonState;
  readonly displayProgress: number;
  readonly progressType: ProgressType | "";
  readonly stage?: ProgressStage;
  readonly downloadType?: DownloadType;
  readonly getIsDownloadable: () => boolean;
  readonly getIsFilenameValid: () => boolean;
  readonly estimatedSizeLabel: string;
}>;

export function createFooterState(params: FooterParams) {
  const downloadingLabel = $derived.by(() => {
    const activity = describeActivity({
      progressType: params.progressType,
      stage: params.stage,
      progress: params.displayProgress,
      downloadType: params.downloadType
    });
    const isProgressZero = params.displayProgress === 0;
    return isProgressZero ? activity : `${formatPercent(params.displayProgress / 100)} - ${activity}`;
  });

  function attachPrimaryButton(elButton: Element) {
    attachPrimaryButtonElement({
      elButton,
      getState: () => params.primaryState,
      getIsDownloadable: params.getIsDownloadable,
      getIsFilenameValid: params.getIsFilenameValid,
      getEstimatedSizeLabel: () => params.estimatedSizeLabel
    });
  }

  return {
    get downloadingLabel() {
      return downloadingLabel;
    },
    attachPrimaryButton
  };
}
