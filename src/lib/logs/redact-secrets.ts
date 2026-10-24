const URL_PATTERN = /https?:\/\/[^\s"'<>)\]]+/g;
const NAMED_SECRET_PATTERN =
  /((?<![A-Za-z0-9])"?(?:poToken|po_token|pot|visitorData|visitor_data|authorization|cookie|set-cookie|apikey|api_key|access_token|x-goog-[a-z-]+)"?\s*[:=]\s*)(?!(?:true|false|null)\b)("[^"]*"|[^\s,;&}]+)/gi;
const AUTH_SCHEME_PATTERN = /\b(Bearer|SAPISIDHASH)\s+\S+/gi;
const OPAQUE_TOKEN_PATTERN = /[A-Za-z0-9_\-+/=]{80,}/g;
const GOOGLE_VIDEO_HOST_SUFFIX = "googlevideo.com";
const REDACTED_PATH = "/<redacted>";
const REDACTED_QUERY = "?<redacted>";
const REDACTED_VALUE = "<redacted>";
const REDACTED_TOKEN = "<token>";

// Signed media URLs carry the session's credentials in the path and query, so only the host survives
function redactUrl(rawUrl: string) {
  const isParsable = URL.canParse(rawUrl);
  if (!isParsable) {
    return REDACTED_VALUE;
  }

  const url = new URL(rawUrl);
  const isGoogleVideo = url.hostname.endsWith(GOOGLE_VIDEO_HOST_SUFFIX);
  if (isGoogleVideo) {
    return `${url.origin}${REDACTED_PATH}`;
  }

  const videoId = url.searchParams.get("v");
  if (videoId) {
    return `${url.origin}${url.pathname}?v=${videoId}`;
  }

  return `${url.origin}${url.pathname}${url.search ? REDACTED_QUERY : ""}`;
}

export function redactSecrets(text: string) {
  return text
    .replace(URL_PATTERN, redactUrl)
    .replace(AUTH_SCHEME_PATTERN, `$1 ${REDACTED_VALUE}`)
    .replace(NAMED_SECRET_PATTERN, `$1"${REDACTED_VALUE}"`)
    .replace(OPAQUE_TOKEN_PATTERN, REDACTED_TOKEN);
}
