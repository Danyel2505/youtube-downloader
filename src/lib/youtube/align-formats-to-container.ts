import { isPremiumFormat } from "./format-display";
import { appendReencodedVariants } from "./reencode-formats";
import { alignAudioFormatToExtension, pickBestByBitrate } from "./select-audio-format";
import {
  getOutputExtension,
  getVideoCodecQualityRank,
  isDynamicRangePreferred,
  resolveAudioCodecPreference,
  resolveDynamicRangePreference,
  resolveVideoCodecPreference,
  isSameVideoCodec,
  isVideoCodecPreferredForContainer,
  isVideoNativeForContainer
} from "@/lib/utils/container-specs";
import {
  DynamicRangePreference,
  type AdaptiveFormatItem,
  type CodecPreferences,
  type Prettify,
  type VideoData
} from "@/types";

type ContainerAlignmentVideoData = Prettify<Pick<VideoData, "videoFormats" | "videoFormatVariants" | "audioFormats">>;

export function resolveVideoFormatVariants(videoData: Pick<VideoData, "videoFormats" | "videoFormatVariants">) {
  return appendReencodedVariants(videoData.videoFormatVariants ?? videoData.videoFormats);
}

// The preferences a hand-picked format satisfies, so alignment keeps exactly that format
export function pinVideoCodecPreferences({ codecPreferences, videoFormat }: {
  codecPreferences: CodecPreferences;
  videoFormat: AdaptiveFormatItem;
}) {
  return {
    ...codecPreferences,
    videoCodec: resolveVideoCodecPreference(videoFormat.mimeType) ?? codecPreferences.videoCodec,
    dynamicRange: resolveDynamicRangePreference(videoFormat.mimeType)
  };
}

export function pinAudioCodecPreferences({ codecPreferences, audioFormat }: {
  codecPreferences: CodecPreferences;
  audioFormat: AdaptiveFormatItem;
}) {
  return {
    ...codecPreferences,
    audioCodec: resolveAudioCodecPreference(audioFormat.mimeType) ?? codecPreferences.audioCodec
  };
}

type CreateVideoFormatPreferenceParams = Prettify<{
  videoFormatVariants: AdaptiveFormatItem[];
  targetExtension: string;
  codecPreferences: CodecPreferences;
}>;
// The codec setting ranks streams, except that "HDR when available" puts any HDR stream the
// container holds as-is ahead of a preferred codec in SDR (H.264 never comes in HDR)
export function createVideoFormatPreference({
  videoFormatVariants, targetExtension, codecPreferences
}: CreateVideoFormatPreferenceParams) {
  const offeredMimeTypes = videoFormatVariants.map(format => format.mimeType);
  const isHdrWanted = codecPreferences.dynamicRange === DynamicRangePreference.Hdr;

  function isCodecPreferred(format: AdaptiveFormatItem) {
    return isVideoCodecPreferredForContainer({
      videoMimeType: format.mimeType,
      targetExtension,
      codecPreferences,
      offeredMimeTypes
    });
  }

  function isRangePreferred(format: AdaptiveFormatItem) {
    return isDynamicRangePreferred({
      videoMimeType: format.mimeType,
      codecPreferences
    });
  }

  function isCodecAndRangePreferred(format: AdaptiveFormatItem) {
    return isCodecPreferred(format) && isRangePreferred(format);
  }

  function isWantedHdr(format: AdaptiveFormatItem) {
    return isHdrWanted && isRangePreferred(format) && isVideoNativeForContainer({
      videoMimeType: format.mimeType,
      targetExtension
    });
  }

  return {
    isCodecPreferred,
    isRangePreferred,
    isCodecAndRangePreferred,
    isWantedHdr,
    isPreferred: (format: AdaptiveFormatItem) => isCodecAndRangePreferred(format) || isWantedHdr(format)
  };
}

// Same resolution, so the stream YouTube serves comes first, then the better codec, then more bitrate
function pickBestVideoQuality(formats: AdaptiveFormatItem[]) {
  return formats.reduce<AdaptiveFormatItem | null>((best, format) => {
    if (!best) {
      return format;
    }

    const nativeGain = Number(!format.reencode) - Number(!best.reencode);
    const codecGain = getVideoCodecQualityRank(format.mimeType) - getVideoCodecQualityRank(best.mimeType);
    const gain = nativeGain || codecGain || format.bitrate - best.bitrate;
    return gain > 0 ? format : best;
  }, null);
}

type AlignVideoFormatToExtensionParams = Prettify<CreateVideoFormatPreferenceParams & {
  currentFormat: AdaptiveFormatItem;
}>;
export function alignVideoFormatToExtension({
  videoFormatVariants,
  currentFormat,
  targetExtension,
  codecPreferences
}: AlignVideoFormatToExtensionParams) {
  const preference = createVideoFormatPreference({
    videoFormatVariants,
    targetExtension,
    codecPreferences
  });
  const siblings = videoFormatVariants.filter(format =>
    format.height === currentFormat.height
    && format.fps === currentFormat.fps
    && isPremiumFormat(format) === isPremiumFormat(currentFormat));
  const sameCodecSiblings = siblings.filter(format => isSameVideoCodec(format.mimeType, currentFormat.mimeType));
  return pickBestVideoQuality(siblings.filter(preference.isCodecAndRangePreferred))
    ?? pickBestByBitrate(siblings.filter(preference.isWantedHdr))
    ?? pickBestByBitrate(sameCodecSiblings.filter(preference.isRangePreferred))
    ?? pickBestByBitrate(siblings.filter(preference.isCodecPreferred))
    ?? currentFormat;
}

// Swaps video+audio picks for same-quality variants in the container's preferred
// codecs (MP4 -> H.264/AAC, WebM -> VP9/Opus) so they're copied, not re-encoded (issue #21)
type AlignFormatsToContainerParams = Prettify<{
  videoData: ContainerAlignmentVideoData;
  videoFormat: AdaptiveFormatItem;
  audioFormat: AdaptiveFormatItem | null;
  targetExtension: string;
  codecPreferences: CodecPreferences;
}>;
export function alignFormatsToContainer({
  videoData, videoFormat, audioFormat, targetExtension, codecPreferences
}: AlignFormatsToContainerParams) {
  return {
    videoFormat: alignVideoFormatToExtension({
      videoFormatVariants: resolveVideoFormatVariants(videoData),
      currentFormat: videoFormat,
      targetExtension,
      codecPreferences
    }),
    audioFormat: audioFormat && alignAudioFormatToExtension({
      audioFormats: videoData.audioFormats,
      currentFormat: audioFormat,
      targetExtension,
      codecPreferences
    })
  };
}

type ResolveOutputExtensionForFormatsParams = Prettify<{
  videoData: ContainerAlignmentVideoData;
  videoFormat: AdaptiveFormatItem;
  audioFormat: AdaptiveFormatItem;
  userExtension: string;
  codecPreferences: CodecPreferences;
}>;
export function resolveOutputExtensionForFormats({
  videoData, videoFormat, audioFormat, userExtension, codecPreferences
}: ResolveOutputExtensionForFormatsParams) {
  const aligned = alignFormatsToContainer({
    videoData,
    videoFormat,
    audioFormat,
    targetExtension: userExtension,
    codecPreferences
  });
  return getOutputExtension({
    videoMimeType: aligned.videoFormat.mimeType,
    audioMimeType: (aligned.audioFormat ?? audioFormat).mimeType,
    userExtension
  });
}
