import type { TpYtIronDropdownElement } from "@/types";

const IRON_OVERLAY_OPENED_EVENT = "iron-overlay-opened";
const IRON_OVERLAY_CLOSED_EVENT = "iron-overlay-closed";
const SCROLL_EVENT = "scroll";
const SCROLL_LISTENER_OPTIONS = {
  capture: true,
  passive: true
} as const;

// The dropdown locks scrolling outside itself by default, which freezes the page behind the open panel.
// This lets the page scroll and keeps the panel pinned to its button while it does
export function allowPageScrollBehindDropdown(elDropdown: TpYtIronDropdownElement) {
  elDropdown.allowOutsideScroll = true;

  let isRefitQueued = false;

  function refitOnNextFrame() {
    if (isRefitQueued) {
      return;
    }

    isRefitQueued = true;
    requestAnimationFrame(() => {
      isRefitQueued = false;

      if (elDropdown.opened) {
        elDropdown.refit();
      }
    });
  }

  function onPageScroll(e: Event) {
    const isScrollInsidePanel = e.target instanceof Node && elDropdown.contains(e.target);
    if (isScrollInsidePanel) {
      return;
    }

    refitOnNextFrame();
  }

  elDropdown.addEventListener(IRON_OVERLAY_OPENED_EVENT, e => {
    const isInnerOverlay = e.target !== elDropdown;
    if (isInnerOverlay) {
      return;
    }

    addEventListener(SCROLL_EVENT, onPageScroll, SCROLL_LISTENER_OPTIONS);
  });
  elDropdown.addEventListener(IRON_OVERLAY_CLOSED_EVENT, e => {
    const isInnerOverlay = e.target !== elDropdown;
    if (isInnerOverlay) {
      return;
    }

    removeEventListener(SCROLL_EVENT, onPageScroll, SCROLL_LISTENER_OPTIONS);
  });
}
