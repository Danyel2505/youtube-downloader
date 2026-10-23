import { updateAvailableVersionItem } from "@/lib/storage/storage";
import { z } from "@/lib/zod";

const UPDATE_CHECK_ALARM = "ytdlUpdateCheck";
const CHECK_PERIOD_MINUTES = 24 * 60;
const RELEASES_API = "https://api.github.com/repos/avi12/youtube-downloader/releases?per_page=30";
const STABLE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;
const BADGE_TEXT = "!";
const BADGE_COLOR = "#cc0000";

const releasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    draft: z.boolean(),
    prerelease: z.boolean()
  })
);

function compareVersions(versionA: string, versionB: string) {
  return versionA.localeCompare(versionB, undefined, { numeric: true });
}

function getMajorVersion(version: string) {
  return version.split(".")[0];
}

async function fetchLatestVersion(currentVersion: string) {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) {
    return null;
  }

  const releases = releasesSchema.safeParse(await response.json());
  if (!releases.success) {
    return null;
  }

  const sameLineVersions = releases.data
    .filter(release => !release.draft && !release.prerelease)
    .flatMap(release => STABLE_TAG_PATTERN.exec(release.tag_name)?.slice(1) ?? [])
    .filter(version => getMajorVersion(version) === getMajorVersion(currentVersion));
  return sameLineVersions.toSorted(compareVersions).at(-1) ?? null;
}

async function applyAvailableUpdate(availableVersion: string | null) {
  const previousVersion = await updateAvailableVersionItem.getValue();
  if (availableVersion === previousVersion) {
    return;
  }

  await updateAvailableVersionItem.setValue(availableVersion);
  await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await browser.action.setBadgeText({ text: availableVersion ? BADGE_TEXT : "" });
}

async function checkForUpdate() {
  const currentVersion = browser.runtime.getManifest().version;
  const latestVersion = await fetchLatestVersion(currentVersion);
  if (!latestVersion) {
    return;
  }

  await applyAvailableUpdate(compareVersions(latestVersion, currentVersion) > 0 ? latestVersion : null);
}

async function handleUpdateCheckAlarm({ name }: Browser.alarms.Alarm) {
  if (name !== UPDATE_CHECK_ALARM) {
    return;
  }

  await checkForUpdate();
}

async function ensureUpdateCheckAlarm() {
  const existingAlarm = await browser.alarms.get(UPDATE_CHECK_ALARM);
  if (existingAlarm) {
    return;
  }

  await browser.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: CHECK_PERIOD_MINUTES });
}

// Firefox auto-applies self-hosted updates via browser_specific_settings.gecko.update_url,
// so the notifier is Chromium-only - there users drag in a .zip or .crx in Developer mode,
// which never auto-updates.
export function registerUpdateCheck() {
  if (import.meta.env.FIREFOX) {
    return;
  }

  browser.alarms.onAlarm.addListener(handleUpdateCheckAlarm);
  ensureUpdateCheckAlarm().catch(() => {});
  checkForUpdate().catch(() => {});
}
