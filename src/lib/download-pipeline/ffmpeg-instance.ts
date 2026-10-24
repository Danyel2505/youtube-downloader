import { cancelMuxJobs as cancelQueuedMuxJobs } from "./mux-queue";
import type { FFmpegCoreBuild } from "./mux-worker-types";
import { WorkerMessageType } from "./mux-worker-types";
import { getPendingJobReject, sendCancelToWorker, setWorkerPort } from "./worker-jobs";
import { createHostWorkerPort } from "./worker-port-host";
import { MessageType, sendMessage } from "@/lib/messaging/messaging";
import { createLogger, LogScope } from "@/lib/utils/logger";

const log = createLogger(LogScope.Ffmpeg);

export {
  runEmbedMetadata,
  runMuxVideoAudio,
  runTranscodeAudio,
  runTranscodeFile
} from "./worker-jobs";

// Queued jobs are dropped here; the one the worker is running (a H.265 re-encode can take minutes) stops
// at its next checkpoint
export function cancelMuxJobs(videoIds: string[]) {
  cancelQueuedMuxJobs(videoIds);
  sendCancelToWorker(videoIds);
}

export async function initMuxWorker({ coreBuild, wasmBinary }: {
  coreBuild: FFmpegCoreBuild;
  wasmBinary: ArrayBuffer;
}) {
  const hostPort = createHostWorkerPort();
  setWorkerPort(hostPort);

  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(browser.runtime.getURL("/mux-worker.js"), { type: "module" });
    let isReady = false;
    hostPort.onMessage({
      [WorkerMessageType.Ready]() {
        isReady = true;
        resolve();
      },
      [WorkerMessageType.Error]({ message }) {
        if (!isReady) {
          worker.terminate();
        }

        reject(new Error(message));
      }
    });

    worker.onerror = e => {
      const error = new Error(`Worker crashed: ${e.message}`);
      log.error("Mux worker crashed:", e.message);
      const rejectJob = getPendingJobReject();
      const hasRejectJob = rejectJob !== null;
      if (hasRejectJob) {
        rejectJob(error);
      } else {
        reject(error);
      }
    };
    worker.postMessage({
      type: WorkerMessageType.Init,
      coreBuild,
      wasmBinary,
      port: hostPort.port
    }, [wasmBinary, hostPort.port]);
  });

  await sendMessage(MessageType.PipelineFFmpegReady);
}
