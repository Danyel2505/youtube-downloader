import { findAudioFormatForPlayerTrack } from "./panel-audio-actions";
import { PLAYER_ACTIVE_AUDIO } from "./player-active-tracks.svelte";
import { isAudioTrackInLanguages } from "@/lib/youtube/audio-format-helpers";
import { AUTO_DUB_TRACK_SUFFIX } from "@/lib/youtube/download-plan";
import {
  normalizeLanguageCode,
  selectPreferredAudioFormat,
  sortAudioFormatsByDisplayName
} from "@/lib/youtube/video-helpers";
import {
  AudioTrackLanguageMode,
  PanelTrackMode,
  type AdaptiveFormatItem,
  type Options,
  type Prettify,
  type VideoData
} from "@/types";

const IS_WATCH_PAGE = location.pathname === "/watch";

export { IS_WATCH_PAGE };

export function getPreferredMusicAudioFormat(audioFormats: AdaptiveFormatItem[]) {
  return audioFormats.find(format => format.mimeType.includes("mp4")) ?? audioFormats[0] ?? null;
}

type OptionsVideoDataParams = Prettify<{
  options: Options;
  videoData: VideoData;
}>;
export function resolveInitialAudioFormat({ options, videoData }: OptionsVideoDataParams) {
  if (videoData.isMusic) {
    return getPreferredMusicAudioFormat(videoData.audioFormats);
  }

  const isFollowPlayerMode = IS_WATCH_PAGE && (
    options.audioTrackLanguageMode === AudioTrackLanguageMode.MatchVideo ||
    options.audioTrackLanguageMode === AudioTrackLanguageMode.MatchYouTube
  );
  if (isFollowPlayerMode) {
    const playerTrackId = PLAYER_ACTIVE_AUDIO.trackId;
    if (playerTrackId) {
      const match = findAudioFormatForPlayerTrack({
        audioFormats: videoData.audioFormats,
        trackId: playerTrackId,
        langCode: normalizeLanguageCode(playerTrackId)
      });
      if (match) {
        return match;
      }
    }
  }

  const preferred = selectPreferredAudioFormat({
    audioFormats: videoData.audioFormats,
    videoMimeType: videoData.videoFormats[0]?.mimeType ?? "",
    languageMode: options.audioTrackLanguageMode,
    locale: document.documentElement.lang,
    browserLanguage: navigator.language,
    customLanguage: options.customLanguage
  });
  return preferAllowedLanguage({
    preferred,
    options,
    audioFormats: videoData.audioFormats
  });
}

type PreferAllowedLanguageParams = Prettify<{
  preferred: AdaptiveFormatItem | null;
  options: Options;
  audioFormats: AdaptiveFormatItem[];
}>;
function preferAllowedLanguage({ preferred, options, audioFormats }: PreferAllowedLanguageParams) {
  const preferredTrackId = preferred?.audioTrack?.id;
  const isPreferredAllowed = !preferredTrackId || isAudioTrackInLanguages({
    trackId: preferredTrackId,
    languages: options.audioLanguages
  });
  if (isPreferredAllowed) {
    return preferred;
  }

  for (const language of options.audioLanguages) {
    const matches = audioFormats.filter(format => isTrackOfLanguage({
      format,
      language,
      isAutoDubbingIncluded: options.includeAutoDubbing
    }));
    const match = matches.find(format => format.itag === preferred?.itag) ?? matches[0];
    if (match) {
      return match;
    }
  }

  return preferred;
}

function isTrackOfLanguage({ format, language, isAutoDubbingIncluded }: {
  format: AdaptiveFormatItem;
  language: string;
  isAutoDubbingIncluded: boolean;
}) {
  const trackId = format.audioTrack?.id;
  if (!trackId) {
    return false;
  }

  const isAutoDubBlocked = !isAutoDubbingIncluded && trackId.endsWith(AUTO_DUB_TRACK_SUFFIX);
  return !isAutoDubBlocked && normalizeLanguageCode(trackId) === language;
}

type FindMatchedCustomLangCodeParams = Prettify<{
  options: Options;
  audioFormats: AdaptiveFormatItem[];
}>;
function findMatchedCustomLangCode({ options, audioFormats }: FindMatchedCustomLangCodeParams) {
  const isCustomMode = options.audioTrackLanguageMode === AudioTrackLanguageMode.Custom;
  if (!isCustomMode || !options.customLanguage) {
    return null;
  }

  const langCode = normalizeLanguageCode(options.customLanguage);
  const isMatchFound = audioFormats.some(
    format => format.audioTrack && normalizeLanguageCode(format.audioTrack.id) === langCode
  );
  return isMatchFound ? langCode : null;
}

export function resolveInitialAudioMode({ options, videoData }: OptionsVideoDataParams) {
  if (options.audioTrackLanguageMode === AudioTrackLanguageMode.OriginalLanguage) {
    return PanelTrackMode.Original;
  }

  const customLangCode = findMatchedCustomLangCode({
    options,
    audioFormats: videoData.audioFormats
  });
  return customLangCode ? PanelTrackMode.Custom : PanelTrackMode.MatchVideo;
}

export function resolveInitialAudioCustomLanguage({ options, videoData }: OptionsVideoDataParams) {
  const customLangCode = findMatchedCustomLangCode({
    options,
    audioFormats: videoData.audioFormats
  });
  if (customLangCode) {
    return customLangCode;
  }

  const firstTrack = sortAudioFormatsByDisplayName(videoData.audioFormats)[0];
  return firstTrack?.audioTrack ? normalizeLanguageCode(firstTrack.audioTrack.id) : "";
}
