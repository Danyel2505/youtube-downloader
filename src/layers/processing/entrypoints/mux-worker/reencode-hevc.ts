import { isKeyFrame, openIvf, resolveDecoderCodec } from "./ivf-reader";
import type { IvfFrame, IvfHeader } from "./ivf-reader";
import { createLogger, LogScope } from "@/lib/utils/logger";
import { createStallChecker } from "@/lib/utils/stream-stall";
import { buildHevcEncoderConfig, isHevcEncoderConfigSupported } from "@/lib/video-reencode/hevc-config";
import type { Prettify, VideoReencodeSpec } from "@/types";

const log = createLogger(LogScope.Ffmpeg);

const MAX_DECODE_QUEUE = 4;
const MAX_ENCODE_QUEUE = 4;
const MAX_PENDING_FRAMES = 6;
const KEY_FRAME_INTERVAL_SECONDS = 2;
const PROGRESS_REPORT_DELTA = 0.01;
const EVEN_DIMENSION_STEP = 2;
const PROGRESS_LOG_STEPS = 10;
const MICROSECONDS_PER_SECOND = 1_000_000;

type ReencodeProgress = Prettify<{
  encodedFrameCount: number;
  lastTimestampMicroseconds: number;
  lastReportedProgress: number;
  isEncoderConfigured: boolean;
}>;

type ReencodeContext = Prettify<{
  spec: VideoReencodeSpec;
  header: IvfHeader;
  encoder: VideoEncoder;
  decoder: VideoDecoder;
  pendingFrames: VideoFrame[];
  failure: Promise<never>;
  keyFrameInterval: number;
  progress: ReencodeProgress;
  onProgress: (fraction: number) => void;
  throwIfCancelled: () => void;
}>;

type ReencodeIvfToHevcParams = Prettify<{
  ivfFile: File;
  sourceMimeType: string;
  spec: VideoReencodeSpec;
  output: FileSystemSyncAccessHandle;
  onProgress: (fraction: number) => void;
  throwIfCancelled: () => void;
}>;

function toEvenDimension(value: number) {
  return Math.floor(value / EVEN_DIMENSION_STEP) * EVEN_DIMENSION_STEP;
}

function waitForDequeue(target: VideoDecoder | VideoEncoder) {
  return new Promise<void>(resolve => {
    target.addEventListener("dequeue", () => resolve(), { once: true });
  });
}

function untilDequeueOrFailure({ failure }: ReencodeContext, target: VideoDecoder | VideoEncoder) {
  return Promise.race([waitForDequeue(target), failure]);
}

async function configureEncoder({ spec, encoder, progress }: ReencodeContext, frame: VideoFrame) {
  const config = buildHevcEncoderConfig({
    width: toEvenDimension(frame.displayWidth),
    height: toEvenDimension(frame.displayHeight),
    frameRate: spec.frameRate,
    bitrate: spec.bitrate
  });
  const isSupported = await isHevcEncoderConfigSupported(config);
  log.info("H.265 encoder config", {
    isSupported,
    config
  });

  if (!isSupported) {
    throw new Error(`This device can't encode H.265 video at ${config.width}x${config.height}`);
  }

  encoder.configure(config);
  progress.isEncoderConfigured = true;
}

async function encodeFrame(context: ReencodeContext, frame: VideoFrame) {
  const { encoder, progress, keyFrameInterval } = context;
  if (!progress.isEncoderConfigured) {
    await configureEncoder(context, frame);
  }

  while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
    await untilDequeueOrFailure(context, encoder);
  }

  encoder.encode(frame, { keyFrame: progress.encodedFrameCount % keyFrameInterval === 0 });
  progress.encodedFrameCount++;
  progress.lastTimestampMicroseconds = frame.timestamp;
}

function toLogStep(progressFraction: number) {
  return Math.floor(progressFraction * PROGRESS_LOG_STEPS);
}

function reportEncodeProgress({ header, progress, onProgress }: ReencodeContext) {
  const isDurationKnown = header.durationMicroseconds > 0;
  const fraction = isDurationKnown ? Math.min(progress.lastTimestampMicroseconds / header.durationMicroseconds, 1) : 0;
  if (fraction - progress.lastReportedProgress < PROGRESS_REPORT_DELTA) {
    return;
  }

  const isNewLogStep = toLogStep(fraction) > toLogStep(progress.lastReportedProgress);
  if (isNewLogStep) {
    log.info("H.265 encode progress", {
      percent: Math.round(fraction * 100),
      encodedFrames: progress.encodedFrameCount,
      videoSeconds: Math.round(progress.lastTimestampMicroseconds / MICROSECONDS_PER_SECOND)
    });
  }

  progress.lastReportedProgress = fraction;
  onProgress(fraction);
}

async function encodePendingFrames(context: ReencodeContext) {
  while (context.pendingFrames.length > 0) {
    context.throwIfCancelled();
    const frame = context.pendingFrames.shift()!;
    try {
      await encodeFrame(context, frame);
    } finally {
      frame.close();
    }

    reportEncodeProgress(context);
  }
}

async function waitForRoomToDecode(context: ReencodeContext) {
  const { decoder, pendingFrames } = context;
  while (decoder.decodeQueueSize > MAX_DECODE_QUEUE || pendingFrames.length > MAX_PENDING_FRAMES) {
    await encodePendingFrames(context);

    if (decoder.decodeQueueSize > MAX_DECODE_QUEUE) {
      await untilDequeueOrFailure(context, decoder);
    }
  }
}

type FeedDecoderParams = Prettify<{
  context: ReencodeContext;
  frames: AsyncGenerator<IvfFrame>;
  decoderConfig: VideoDecoderConfig;
}>;
async function feedDecoder({ context, frames, decoderConfig }: FeedDecoderParams) {
  const { decoder, encoder, header, failure } = context;
  decoder.configure(decoderConfig);
  let isFirstFrame = true;
  for await (const frame of frames) {
    context.throwIfCancelled();
    await waitForRoomToDecode(context);
    const isKey = isFirstFrame || isKeyFrame({
      fourcc: header.fourcc,
      data: frame.data
    });
    isFirstFrame = false;
    decoder.decode(
      new EncodedVideoChunk({
        type: isKey ? "key" : "delta",
        timestamp: frame.timestampMicroseconds,
        data: frame.data
      })
    );
    await encodePendingFrames(context);
  }

  await Promise.race([decoder.flush(), failure]);
  await encodePendingFrames(context);
  await Promise.race([encoder.flush(), failure]);
}

function releaseCodecs({ pendingFrames, decoder, encoder }: ReencodeContext) {
  for (const frame of pendingFrames) {
    frame.close();
  }

  pendingFrames.length = 0;

  if (decoder.state !== "closed") {
    decoder.close();
  }

  if (encoder.state !== "closed") {
    encoder.close();
  }
}

async function buildDecoderConfig({ sourceMimeType, header }: {
  sourceMimeType: string;
  header: IvfHeader;
}) {
  const decoderConfig: VideoDecoderConfig = {
    codec: resolveDecoderCodec({
      mimeType: sourceMimeType,
      fourcc: header.fourcc
    }),
    codedWidth: header.width,
    codedHeight: header.height
  };
  const decoderSupport = await VideoDecoder.isConfigSupported(decoderConfig).catch(() => null);
  log.info("Video decoder config", {
    isSupported: !!decoderSupport?.supported,
    config: decoderConfig
  });

  if (!decoderSupport?.supported) {
    throw new Error(`This browser can't decode ${decoderConfig.codec || header.fourcc} video`);
  }

  return decoderConfig;
}

type CreateCodecsParams = Prettify<{
  output: FileSystemSyncAccessHandle;
  pendingFrames: VideoFrame[];
  progress: ReencodeProgress;
  rejectFailure: (error: Error) => void;
  touchActivity: () => void;
}>;
function createCodecs({ output, pendingFrames, progress, rejectFailure, touchActivity }: CreateCodecsParams) {
  output.truncate(0);
  let writeOffset = 0;
  const encoder = new VideoEncoder({
    output(chunk) {
      touchActivity();
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      output.write(bytes, { at: writeOffset });
      writeOffset += bytes.byteLength;
    },
    error(error) {
      rejectFailure(new Error(`H.265 encoder failed after ${progress.encodedFrameCount} frames: ${error.name} ${error.message}`));
    }
  });
  const decoder = new VideoDecoder({
    output(frame) {
      touchActivity();
      pendingFrames.push(frame);
    },
    error(error) {
      rejectFailure(new Error(`Video decoder failed after ${progress.encodedFrameCount} frames: ${error.name} ${error.message}`));
    }
  });
  return {
    encoder,
    decoder
  };
}

// Decodes the IVF stream with the browser's decoder and encodes every frame as H.265 (Annex B) into
// the output file. The encoder is the device's hardware one: the browser has no software H.265 encoder
export async function reencodeIvfToHevc({
  ivfFile, sourceMimeType, spec, output, onProgress, throwIfCancelled
}: ReencodeIvfToHevcParams) {
  const { header, frames } = await openIvf(ivfFile);
  const decoderConfig = await buildDecoderConfig({
    sourceMimeType,
    header
  });
  log.info("H.265 re-encode input", {
    fourcc: header.fourcc,
    width: header.width,
    height: header.height,
    durationSeconds: Math.round(header.durationMicroseconds / MICROSECONDS_PER_SECOND),
    decoderCodec: decoderConfig.codec,
    spec
  });

  const { promise: failure, reject: rejectFailure } = Promise.withResolvers<never>();
  failure.catch(() => {});
  const pendingFrames: VideoFrame[] = [];
  const progress: ReencodeProgress = {
    encodedFrameCount: 0,
    lastTimestampMicroseconds: 0,
    lastReportedProgress: 0,
    isEncoderConfigured: false
  };
  // Neither codec answered for a while, so say so instead of leaving the download "processing"
  const stallChecker = createStallChecker(() => {
    rejectFailure(new Error(`The H.265 conversion stopped responding after ${progress.encodedFrameCount} frames`));
  });
  const { encoder, decoder } = createCodecs({
    output,
    pendingFrames,
    progress,
    rejectFailure,
    touchActivity: stallChecker.touch
  });
  const context: ReencodeContext = {
    spec,
    header,
    encoder,
    decoder,
    pendingFrames,
    failure,
    keyFrameInterval: Math.max(1, Math.round(spec.frameRate * KEY_FRAME_INTERVAL_SECONDS)),
    progress,
    onProgress,
    throwIfCancelled
  };

  const feeding = feedDecoder({
    context,
    frames,
    decoderConfig
  });
  feeding.catch(() => {});
  try {
    await Promise.race([feeding, failure]);
  } finally {
    stallChecker.clear();
    releaseCodecs(context);
  }

  const isOutputEmpty = output.getSize() === 0;
  if (isOutputEmpty) {
    throw new Error("The H.265 encoder produced no output");
  }

  output.flush();
  log.info("H.265 re-encode finished", {
    encodedFrames: progress.encodedFrameCount,
    outputBytes: output.getSize()
  });
  return progress.encodedFrameCount;
}
