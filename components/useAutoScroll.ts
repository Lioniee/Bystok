"use client";

import { type RefObject, useEffect, useState } from "react";

// Slow, continuous sideways scrolling for the phone token strip, as a seamless
// loop: the list is rendered twice, and when the first copy has scrolled fully
// out of view we jump back by exactly its width, which looks identical.
//
// It moves the real scroll position (not a CSS transform), so swiping by hand
// keeps working. It pauses on hover, touch, wheel/drag, keyboard focus and
// hidden tabs, and resumes a few seconds after the viewer stops interacting.

const SPEED_PX_PER_S = 22;
const RESUME_AFTER_MS = 3000;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Width of one copy of the list, measured from the first item to the first
// item of the duplicate (marked with data-loop-start), so it includes the gap.
function loopWidth(el: HTMLElement) {
  const first = el.firstElementChild as HTMLElement | null;
  const start = el.querySelector<HTMLElement>("[data-loop-start]");
  return first && start ? start.offsetLeft - first.offsetLeft : 0;
}

// Width of the original items only (whether or not the duplicate is rendered).
function contentWidth(el: HTMLElement) {
  const items = [...el.children].filter((c) => !(c as HTMLElement).dataset.loopCopy) as HTMLElement[];
  if (items.length === 0) return 0;
  const last = items[items.length - 1];
  return last.offsetLeft + last.offsetWidth - items[0].offsetLeft;
}

// `enabled`: the caller wants motion (strip layout, motion allowed, nothing typed in search).
// Returns whether the list overflows, i.e. whether the duplicate should be rendered.
export function useAutoScroll(ref: RefObject<HTMLElement | null>, enabled: boolean, contentKey: string) {
  const [overflowing, setOverflowing] = useState(false);

  // Only loop when one copy is wider than the strip; otherwise there's nothing to reveal.
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) {
      setOverflowing(false);
      return;
    }
    const measure = () => setOverflowing(contentWidth(el) > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled, contentKey]);

  const running = enabled && overflowing;

  useEffect(() => {
    const el = ref.current;
    if (!el || !running) return;

    let pos = el.scrollLeft; // float: scrollLeft may round, so keep our own position
    let expected = el.scrollLeft;
    let last = performance.now();
    let pausedUntil = 0;
    let hovering = false;
    let touching = false;
    let keyboardFocus = false;
    let frame = 0;

    const pauseBriefly = () => {
      pausedUntil = performance.now() + RESUME_AFTER_MS;
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64); // don't leap after a slow frame or a background tab
      last = now;
      if (!hovering && !touching && !keyboardFocus && now >= pausedUntil && !document.hidden) {
        const w = loopWidth(el);
        pos += (SPEED_PX_PER_S * dt) / 1000;
        if (w > 0 && pos >= w) pos -= w;
        el.scrollLeft = pos;
        expected = el.scrollLeft;
      }
      frame = requestAnimationFrame(tick);
    };

    // A scroll we didn't cause is the viewer swiping: follow it and pause.
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - expected) <= 1) return;
      const w = loopWidth(el);
      pos = el.scrollLeft;
      if (w > 0 && pos >= w) {
        pos -= w;
        el.scrollLeft = pos;
      }
      expected = el.scrollLeft;
      pauseBriefly();
    };
    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovering = true;
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        hovering = false;
        pauseBriefly();
      }
    };
    const onTouchStart = () => {
      touching = true;
    };
    const onTouchEnd = () => {
      touching = false;
      pauseBriefly();
    };
    // Pause for keyboard focus only; a mouse click also focuses the card, and
    // that shouldn't freeze the strip until the viewer clicks elsewhere.
    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement).matches?.(":focus-visible")) keyboardFocus = true;
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) {
        keyboardFocus = false;
        pauseBriefly();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", pauseBriefly, { passive: true });
    el.addEventListener("pointerdown", pauseBriefly);
    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", pauseBriefly);
      el.removeEventListener("pointerdown", pauseBriefly);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [ref, running]);

  return overflowing;
}
