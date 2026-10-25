import { MessageType, sendMessage } from "@/lib/messaging/messaging";
import { ProgressType } from "@/types";
import type { Prettify, ProgressStage } from "@/types";

const PROGRESS_THROTTLE_INTERVAL_MS = 200;
const lastProgressTimestamps = new Map<string, number>();
const completedVideoIds = new Set<string>();

type ReportProgressParams = Prettify<{
  videoId: string;
  progress: number;
  progressType: ProgressType;
  stage?: ProgressStage;
  tabId: number;
}>;
export async function reportProgress({
  videoId, progress, progressType, stage, tabId
}: ReportProgressParams) {
  const isComplete = progress >= 1;
  if (!isComplete) {
    completedVideoIds.delete(videoId);
  }

  const isReset = progress === 0;
  if (isReset) {
    lastProgressTimestamps.delete(videoId);
  }

  if (isComplete) {
    const isAlreadyCompleted = completedVideoIds.has(videoId);
    if (isAlreadyCompleted) {
      return;
    }

    completedVideoIds.add(videoId);
    lastProgressTimestamps.delete(videoId);
    await sendMessage(MessageType.PipelineProgress, {
      videoId,
      progress,
      progressType,
      stage,
      tabId
    });
    return;
  }

  const now = Date.now();
  const lastSent = lastProgressTimestamps.get(videoId) ?? 0;
  const isThrottled = now - lastSent < PROGRESS_THROTTLE_INTERVAL_MS;
  if (isThrottled) {
    return;
  }

  lastProgressTimestamps.set(videoId, now);
  await sendMessage(MessageType.PipelineProgress, {
    videoId,
    progress,
    progressType,
    stage,
    tabId
  });
}
