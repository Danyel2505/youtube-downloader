import { isPremiumFormat } from "./format-display";
import { pickBestByBitrate } from "./select-audio-format";
import { hevcSupport } from "@/lib/ui/hevc-support.svelte";
import { extractBaseCodec, resolveDynamicRangePreference } from "@/lib/utils/container-specs";
import { buildHevcMimeType } from "@/lib/video-reencode/hevc-config";
import {
  DynamicRangePreference,
  VideoReencodeCodec,
  type AdaptiveFormatItem,
  type Prettify,
  type VideoData
} from "@/types";

const REENCODE_ITAG_OFFSET = 1_000_000;
const HEVC_BITRATE_RATIO = 0.85;
const DEFAULT_FRAME_RATE = 30;
const REENCODE_SOURCE_CODECS = new Set(["vp09", "vp9", "av01"]);

type FormatVariantsData = Prettify<Pick<VideoData, "videoFormats" | "videoFormatVariants">>;

// Only VP9 and AV1 come out as an IVF stream the browser decodes, and HDR would lose its range
function isEligibleSource(format: AdaptiveFormatItem) {
  const isSourceCodec = REENCODE_SOURCE_CODECS.has(extractBaseCodec(format.mimeType));
  const isSdr = resolveDynamicRangePreference(format.mimeType) === DynamicRangePreference.Sdr;
  const hasDimensions = !!format.width && !!format.height;
  return isSourceCodec && isSdr && hasDimensions && !format.reencode;
}

// Looks like an H.265 stream of the source's quality, so pickers, containers and size estimates
// treat it as one; the real stream and the re-encode are told apart again by resolveReencodeSource
function toHevcVariant(source: AdaptiveFormatItem): AdaptiveFormatItem {
  const frameRate = source.fps ?? DEFAULT_FRAME_RATE;
  const bitrate = Math.round((source.averageBitrate || source.bitrate) * HEVC_BITRATE_RATIO);
  const mimeType = buildHevcMimeType({
    width: source.width!,
    height: source.height!,
    frameRate
  });
  return {
    ...source,
    itag: REENCODE_ITAG_OFFSET + source.itag,
    mimeType,
    bitrate: Math.round(source.bitrate * HEVC_BITRATE_RATIO),
    averageBitrate: bitrate,
    contentLength: `${Math.round(Number(source.contentLength) * HEVC_BITRATE_RATIO)}`,
    reencode: {
      codec: VideoReencodeCodec.Hevc,
      sourceItag: source.itag,
      mimeType,
      frameRate,
      bitrate
    }
  };
}

function buildHevcVariants({ variants, maxHeight }: {
  variants: AdaptiveFormatItem[];
  maxHeight: number;
}) {
  const sources = variants.filter(format => isEligibleSource(format) && format.height! <= maxHeight);
  const sourcesByQuality = Map.groupBy(
    sources,
    format => `${format.height}-${format.fps ?? ""}-${isPremiumFormat(format)}`
  );
  return [...sourcesByQuality.values()]
    .map(pickBestByBitrate)
    .filter(format => format !== null)
    .map(toHevcVariant);
}

type VariantsCacheEntry = Prettify<{
  maxHeight: number;
  variants: AdaptiveFormatItem[];
}>;
const VARIANTS_CACHE = new WeakMap<AdaptiveFormatItem[], VariantsCacheEntry>();

// The same array, and the same variant objects, on every call: callers compare variants by identity
export function appendReencodedVariants(variants: AdaptiveFormatItem[]) {
  const { maxHeight } = hevcSupport;
  if (!maxHeight) {
    return variants;
  }

  const cached = VARIANTS_CACHE.get(variants);
  if (cached?.maxHeight === maxHeight) {
    return cached.variants;
  }

  const hevcVariants = buildHevcVariants({
    variants,
    maxHeight
  });
  const combined = hevcVariants.length ? [...variants, ...hevcVariants] : variants;
  VARIANTS_CACHE.set(variants, {
    maxHeight,
    variants: combined
  });
  return combined;
}

// The stream to download and what to do to it, for whatever the plan picked
export function resolveReencodeSource({ videoData, plannedFormat }: {
  videoData: FormatVariantsData;
  plannedFormat: AdaptiveFormatItem | null;
}) {
  const spec = plannedFormat?.reencode;
  if (!plannedFormat || !spec) {
    return {
      videoFormat: plannedFormat,
      videoReencode: undefined
    };
  }

  const realVariants = videoData.videoFormatVariants ?? videoData.videoFormats;
  const source = realVariants.find(format => format.itag === spec.sourceItag);
  if (!source) {
    return {
      videoFormat: plannedFormat,
      videoReencode: undefined
    };
  }

  return {
    videoFormat: source,
    videoReencode: {
      codec: spec.codec,
      mimeType: spec.mimeType,
      frameRate: spec.frameRate,
      bitrate: spec.bitrate
    }
  };
}
