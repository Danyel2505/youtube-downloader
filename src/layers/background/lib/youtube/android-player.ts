import type { Prettify } from "@/types";

const INNERTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player";
const ANDROID_VR_CLIENT_NAME = "ANDROID_VR";
const ANDROID_VR_CLIENT_VERSION = "1.65.10";
const ANDROID_VR_SDK_VERSION = 32;
const ANDROID_VR_DEVICE_MAKE = "Oculus";
const ANDROID_VR_DEVICE_MODEL = "Quest 3";
const ANDROID_VR_USER_AGENT =
  "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L) gzip";
const ANDROID_VR_OS_NAME = "Android";
const ANDROID_VR_OS_VERSION = "12L";
const CONTENT_TYPE_JSON = "application/json";

// Placeholder substituted in MAIN-world by page-sabr-fetch.content.ts so the BG
// never needs to read ytcfg.VISITOR_DATA directly (extension contexts cannot
// reach the page's ytcfg).
const VISITOR_DATA_TOKEN = "__YTDL_VISITOR_DATA__";

export type AndroidStreamingFormat = Prettify<{
  itag: number;
  url: string;
  mimeType: string;
  contentLength: string;
  bitrate: number;
  width?: number;
  height?: number;
  audioChannels?: number;
  audioSampleRate?: string;
  audioTrack?: {
    id: string;
    audioIsDefault?: boolean;
  };
}>;

export type AndroidPlayerResponse = Prettify<{
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  streamingData?: {
    formats?: AndroidStreamingFormat[];
    adaptiveFormats?: AndroidStreamingFormat[];
  };
}>;

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type FetchAndroidPlayerResponseParams = Prettify<{
  videoId: string;
  customFetch?: FetchFn;
}>;

// Fetches a YouTube InnerTube `/player` response using the ANDROID_VR client
// (X-YouTube-Client-Name 28). yt-dlp's `android_vr` extractor relies on the
// same client because it is the only first-party client that returns direct
// CDN URLs for all adaptive formats without requiring a PO token, without
// forcing SABR, and without imposing the 4 MB per-request range cap that the
// plain `ANDROID` client enforces.
//
// `credentials: "include"` alone (with `visitorData` embedded in the context)
// is sufficient to pass YouTube's anti-bot gate. Without `visitorData` the
// response is `LOGIN_REQUIRED: "Sign in to confirm you're not a bot"`.
async function fetchAndroidPlayerResponse({
  videoId, customFetch
}: FetchAndroidPlayerResponseParams): Promise<AndroidPlayerResponse> {
  const body = {
    context: {
      client: {
        clientName: ANDROID_VR_CLIENT_NAME,
        clientVersion: ANDROID_VR_CLIENT_VERSION,
        deviceMake: ANDROID_VR_DEVICE_MAKE,
        deviceModel: ANDROID_VR_DEVICE_MODEL,
        androidSdkVersion: ANDROID_VR_SDK_VERSION,
        userAgent: ANDROID_VR_USER_AGENT,
        osName: ANDROID_VR_OS_NAME,
        osVersion: ANDROID_VR_OS_VERSION,
        hl: "en",
        gl: "US",
        visitorData: VISITOR_DATA_TOKEN
      }
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true
  };
  const performFetch = customFetch ?? fetch;
  const response = await performFetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": CONTENT_TYPE_JSON
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`ANDROID_VR player API HTTP ${response.status}`);
  }

  return response.json();
}

export type ResolvedAndroidUrls = Prettify<{
  videoUrl: string | null;
  videoContentLength: number;
  audioUrl: string | null;
  audioContentLength: number;
  extraAudioUrls: {
    url: string | null;
    contentLength: number;
  }[];
}>;

function parseContentLength(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type WantedAudioTrack = Prettify<{
  itag: number;
  trackId?: string;
}>;

type ResolveAndroidUrlsParams = Prettify<{
  videoId: string;
  videoItag?: number;
  videoMimeType?: string;
  videoHeight?: number;
  audioItag?: number;
  audioTrackId?: string;
  extraAudioTracks?: WantedAudioTrack[];
  customFetch?: FetchFn;
}>;

const CODEC_FAMILY_PATTERN = /^([^;]+);\s*codecs="?([a-z0-9]+)/i;

function getCodecFamily(mimeType: string) {
  const [, container = "", codec = ""] = CODEC_FAMILY_PATTERN.exec(mimeType) ?? [];
  return `${container}|${codec.toLowerCase()}`;
}

type PickVideoFormatParams = Prettify<{
  allFormats: AndroidStreamingFormat[];
  adaptiveFormats: AndroidStreamingFormat[];
  itag: number;
  mimeType?: string;
  height?: number;
}>;

// The exact itag wins. When the client doesn't offer it, the nearest height of the
// same container and codec keeps the mux args valid, so no other codec is ever substituted
function pickVideoFormat({ allFormats, adaptiveFormats, itag, mimeType, height }: PickVideoFormatParams) {
  const exactMatch = allFormats.find(format => format.itag === itag);
  if (exactMatch || !mimeType || !height) {
    return exactMatch;
  }

  const family = getCodecFamily(mimeType);
  const sameFamily = adaptiveFormats.filter(
    format => format.mimeType.startsWith("video/") && format.height && getCodecFamily(format.mimeType) === family
  );
  const [nearestNotTaller] = sameFamily
    .filter(format => format.height! <= height)
    .toSorted((formatA, formatB) => formatB.height! - formatA.height!);
  const [nearestTaller] = sameFamily
    .filter(format => format.height! > height)
    .toSorted((formatA, formatB) => formatA.height! - formatB.height!);
  return nearestNotTaller ?? nearestTaller;
}

type PickAudioFormatParams = Prettify<{
  allFormats: AndroidStreamingFormat[];
  itag: number;
  trackId?: string;
}>;

// Dubbed tracks share one itag, so the track id tells them apart. Without track data
// in the response the first format is the only one that can be returned
function pickAudioFormat({ allFormats, itag, trackId }: PickAudioFormatParams) {
  const sameItag = allFormats.filter(format => format.itag === itag);
  const hasTrackData = sameItag.some(format => format.audioTrack);
  if (!trackId) {
    return sameItag.find(format => format.audioTrack?.audioIsDefault) ?? sameItag[0];
  }

  if (!hasTrackData) {
    return sameItag[0];
  }

  return sameItag.find(format => format.audioTrack?.id === trackId);
}

export async function resolveAndroidUrls({
  videoId, videoItag, videoMimeType, videoHeight, audioItag, audioTrackId, extraAudioTracks, customFetch
}: ResolveAndroidUrlsParams): Promise<ResolvedAndroidUrls> {
  const response = await fetchAndroidPlayerResponse({
    videoId,
    customFetch
  });
  const isPlayable = response.playabilityStatus?.status === "OK";
  if (!isPlayable) {
    throw new Error(`ANDROID_VR player not playable: ${response.playabilityStatus?.status} ${response.playabilityStatus?.reason ?? ""}`);
  }

  const adaptiveFormats = response.streamingData?.adaptiveFormats ?? [];
  const progressiveFormats = response.streamingData?.formats ?? [];
  const allFormats = [...adaptiveFormats, ...progressiveFormats];

  const videoMatch = videoItag != null ? pickVideoFormat({
    allFormats,
    adaptiveFormats,
    itag: videoItag,
    mimeType: videoMimeType,
    height: videoHeight
  }) : null;
  const audioMatch = audioItag != null ? pickAudioFormat({
    allFormats,
    itag: audioItag,
    trackId: audioTrackId
  }) : null;
  const extraAudioUrls = (extraAudioTracks ?? []).map(({ itag, trackId }) => {
    const match = pickAudioFormat({
      allFormats,
      itag,
      trackId
    });
    const isDuplicateOfPrimary = !!match && match.url === audioMatch?.url;
    return {
      url: isDuplicateOfPrimary ? null : (match?.url ?? null),
      contentLength: isDuplicateOfPrimary ? 0 : parseContentLength(match?.contentLength)
    };
  });

  return {
    videoUrl: videoMatch?.url ?? null,
    videoContentLength: parseContentLength(videoMatch?.contentLength),
    audioUrl: audioMatch?.url ?? null,
    audioContentLength: parseContentLength(audioMatch?.contentLength),
    extraAudioUrls
  };
}
