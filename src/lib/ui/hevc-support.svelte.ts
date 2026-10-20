import { detectHevcEncodeMaxHeight } from "@/lib/video-reencode/hevc-config";

export const hevcSupport = $state({
  maxHeight: 0
});

let detection: Promise<void> | null = null;

// Detection runs once per context; format lists read hevcSupport, so they update when it lands
export function initHevcSupport() {
  detection ??= detectHevcEncodeMaxHeight().then(maxHeight => {
    hevcSupport.maxHeight = maxHeight;
  });
  return detection;
}
