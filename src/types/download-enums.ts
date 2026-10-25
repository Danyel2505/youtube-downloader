export const DownloadType = {
  Auto: "auto",
  VideoAndAudio: "video+audio",
  Video: "video",
  Audio: "audio"
} as const;

export type DownloadType = (typeof DownloadType)[keyof typeof DownloadType];

export const VideoCodecPreference = {
  Auto: "auto",
  H264: "h264",
  H265: "h265",
  Vp9: "vp9",
  Av1: "av1"
} as const;

export type VideoCodecPreference = (typeof VideoCodecPreference)[keyof typeof VideoCodecPreference];

export const VideoReencodeCodec = {
  Hevc: "hevc"
} as const;

export type VideoReencodeCodec = (typeof VideoReencodeCodec)[keyof typeof VideoReencodeCodec];

export const AudioCodecPreference = {
  Auto: "auto",
  Aac: "aac",
  Opus: "opus",
  Dolby: "dolby"
} as const;

export type AudioCodecPreference = (typeof AudioCodecPreference)[keyof typeof AudioCodecPreference];

export const DynamicRangePreference = {
  Sdr: "sdr",
  Hdr: "hdr"
} as const;

export type DynamicRangePreference = (typeof DynamicRangePreference)[keyof typeof DynamicRangePreference];

export const MaxFrameRate = {
  Any: "any",
  Fps60: "60",
  Fps30: "30"
} as const;

export type MaxFrameRate = (typeof MaxFrameRate)[keyof typeof MaxFrameRate];

export const ProgressType = {
  Video: "video",
  Audio: "audio",
  FFmpeg: "ffmpeg",
  Zip: "zip"
} as const;

export type ProgressType = (typeof ProgressType)[keyof typeof ProgressType];

// What the processing phase is doing right now, so the UI can say it instead of just "Processing"
export const ProgressStage = {
  Extracting: "extracting",
  Reencoding: "reencoding",
  Merging: "merging",
  Saving: "saving"
} as const;

export type ProgressStage = (typeof ProgressStage)[keyof typeof ProgressStage];

export const VideoQualityMode = {
  Best: "best",
  CurrentQuality: "current-quality",
  Custom: "custom"
} as const;

export type VideoQualityMode = (typeof VideoQualityMode)[keyof typeof VideoQualityMode];

export const PlaylistDownloadMode = {
  Fast: "fast",
  DataSaver: "dataSaver"
} as const;

export type PlaylistDownloadMode = (typeof PlaylistDownloadMode)[keyof typeof PlaylistDownloadMode];

export const PlaylistOutputMode = {
  Individual: "individual",
  Zip: "zip"
} as const;

export type PlaylistOutputMode = (typeof PlaylistOutputMode)[keyof typeof PlaylistOutputMode];

export const AudioTrackLanguageMode = {
  OriginalLanguage: "original",
  MatchVideo: "match-video",
  MatchYouTube: "match-youtube",
  Custom: "custom"
} as const;

export type AudioTrackLanguageMode = (typeof AudioTrackLanguageMode)[keyof typeof AudioTrackLanguageMode];

export const CaptionLanguageMode = {
  SameAsAudio: "same-as-audio",
  OriginalLanguage: "original",
  MatchVideo: "match-video",
  MatchYouTube: "match-youtube",
  Custom: "custom"
} as const;

export type CaptionLanguageMode = (typeof CaptionLanguageMode)[keyof typeof CaptionLanguageMode];

export const LanguagePreference = {
  Auto: "auto",
  English: "en",
  SpanishLatinAmerica: "es-419"
} as const;

export type LanguagePreference = (typeof LanguagePreference)[keyof typeof LanguagePreference];
