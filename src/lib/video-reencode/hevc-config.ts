import { resolveWithin } from "@/lib/utils/timeout";
import { ReencodeEngine } from "@/types";
import type { Prettify } from "@/types";

const HEVC_CODEC_PREFIX = "hvc1.1.6.L";
const HEVC_CODEC_SUFFIX = ".B0";
const HEVC_ANNEXB_FORMAT = "annexb";
const HEVC_MIME_TYPE_PREFIX = "video/mp4; codecs=\"";
const HEVC_MIME_TYPE_SUFFIX = "\"";

type HevcLevel = Prettify<{
  id: number;
  maxLumaPictureSize: number;
  maxLumaSampleRate: number;
}>;

// Table A.8 of the H.265 spec: the smallest level whose picture size and sample rate hold the stream
const HEVC_LEVELS: HevcLevel[] = [
  {
    id: 90,
    maxLumaPictureSize: 552_960,
    maxLumaSampleRate: 16_588_800
  },
  {
    id: 93,
    maxLumaPictureSize: 983_040,
    maxLumaSampleRate: 33_177_600
  },
  {
    id: 120,
    maxLumaPictureSize: 2_228_224,
    maxLumaSampleRate: 66_846_720
  },
  {
    id: 123,
    maxLumaPictureSize: 2_228_224,
    maxLumaSampleRate: 133_693_440
  },
  {
    id: 150,
    maxLumaPictureSize: 8_912_896,
    maxLumaSampleRate: 267_386_880
  },
  {
    id: 153,
    maxLumaPictureSize: 8_912_896,
    maxLumaSampleRate: 534_773_760
  },
  {
    id: 156,
    maxLumaPictureSize: 8_912_896,
    maxLumaSampleRate: 1_069_547_520
  },
  {
    id: 180,
    maxLumaPictureSize: 35_651_584,
    maxLumaSampleRate: 1_069_547_520
  },
  {
    id: 183,
    maxLumaPictureSize: 35_651_584,
    maxLumaSampleRate: 2_139_095_040
  },
  {
    id: 186,
    maxLumaPictureSize: 35_651_584,
    maxLumaSampleRate: 4_278_190_080
  }
];

const PROBE_HEIGHTS = [360, 480, 720, 1080, 1440, 2160, 4320];
const PROBE_FRAME_RATE = 30;
const PROBE_ASPECT_RATIO = 16 / 9;
const PROBE_BITS_PER_PIXEL = 0.07;
const EVEN_DIMENSION_STEP = 2;
const PROBE_TIMEOUT_MS = 2_000;

export type HevcStreamShape = Prettify<{
  width: number;
  height: number;
  frameRate: number;
}>;

function resolveHevcLevel({ width, height, frameRate }: HevcStreamShape) {
  const pictureSize = width * height;
  const sampleRate = pictureSize * frameRate;
  const level = HEVC_LEVELS.find(({ maxLumaPictureSize, maxLumaSampleRate }) =>
    pictureSize <= maxLumaPictureSize && sampleRate <= maxLumaSampleRate);
  return (level ?? HEVC_LEVELS.at(-1)!).id;
}

function buildHevcCodecString(shape: HevcStreamShape) {
  return `${HEVC_CODEC_PREFIX}${resolveHevcLevel(shape)}${HEVC_CODEC_SUFFIX}`;
}

export function buildHevcMimeType(shape: HevcStreamShape): `video/${string}` {
  return `${HEVC_MIME_TYPE_PREFIX}${buildHevcCodecString(shape)}${HEVC_MIME_TYPE_SUFFIX}`;
}

export type HevcVideoEncoderConfig = VideoEncoderConfig & {
  hevc: { format: typeof HEVC_ANNEXB_FORMAT };
};

// Graphics card first, then a software encoder, for the browsers that have one: Chrome has none
const HEVC_ENGINES = [
  {
    engine: ReencodeEngine.Gpu,
    hardwareAcceleration: "prefer-hardware"
  },
  {
    engine: ReencodeEngine.Cpu,
    hardwareAcceleration: "prefer-software"
  }
] as const satisfies readonly {
  engine: ReencodeEngine;
  hardwareAcceleration: HardwareAcceleration;
}[];

type HevcEncoderConfigParams = Prettify<HevcStreamShape & {
  bitrate: number;
  hardwareAcceleration?: HardwareAcceleration;
}>;
export function buildHevcEncoderConfig({ bitrate, hardwareAcceleration, ...shape }: HevcEncoderConfigParams) {
  const config: HevcVideoEncoderConfig = {
    codec: buildHevcCodecString(shape),
    width: shape.width,
    height: shape.height,
    framerate: shape.frameRate,
    bitrate: Math.round(bitrate),
    bitrateMode: "variable",
    latencyMode: "quality",
    hevc: {
      format: HEVC_ANNEXB_FORMAT
    },
    ...(hardwareAcceleration && {
      hardwareAcceleration
    })
  };
  return config;
}

export async function isHevcEncoderConfigSupported(config: HevcVideoEncoderConfig) {
  if (typeof VideoEncoder === "undefined") {
    return false;
  }

  try {
    const { supported } = await VideoEncoder.isConfigSupported(config);
    return !!supported;
  } catch {
    return false;
  }
}

// The first encoder the browser reports as able to take the stream, and which processor it runs on
export async function resolveHevcEncoder(config: HevcVideoEncoderConfig) {
  const candidates = HEVC_ENGINES.map(({ engine, hardwareAcceleration }) => ({
    engine,
    config: {
      ...config,
      hardwareAcceleration
    }
  }));
  const support = await Promise.all(candidates.map(candidate => isHevcEncoderConfigSupported(candidate.config)));
  return candidates.find((_, i) => support[i]) ?? null;
}

function toEvenDimension(value: number) {
  return Math.round(value / EVEN_DIMENSION_STEP) * EVEN_DIMENSION_STEP;
}

// The tallest 16:9 picture the browser can encode as H.265, 0 when it can't encode it at all or the
// browser doesn't answer in time (a stuck GPU process must never hold a download back)
export async function detectHevcEncodeMaxHeight() {
  const probes = Promise.all(
    PROBE_HEIGHTS.map(async height => {
      const width = toEvenDimension(height * PROBE_ASPECT_RATIO);
      const encoder = await resolveHevcEncoder(
        buildHevcEncoderConfig({
          width,
          height,
          frameRate: PROBE_FRAME_RATE,
          bitrate: width * height * PROBE_FRAME_RATE * PROBE_BITS_PER_PIXEL
        })
      );
      return encoder ? height : 0;
    })
  );
  const supportedHeights = await resolveWithin({
    promise: probes,
    milliseconds: PROBE_TIMEOUT_MS,
    fallback: [0]
  });
  return Math.max(0, ...supportedHeights);
}
