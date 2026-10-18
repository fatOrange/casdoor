import * as React from "react";
import i18next from "i18next";
import {ThemePreviewMessage} from "@/lib/integration";
import {cn} from "@/lib/utils";

/** the width of the desktop viewport the preview must keep to show desktop rules */
const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 900;

type AuthPreviewPage = "signin" | "signup" | "prompt";

interface ApplicationAuthPreviewFrameProps {
  /** the application the editor currently holds, not the saved one */
  application: unknown;
  page: AuthPreviewPage;
  className?: string;
}

/**
 * One auth page of the edited application, rendered by the same-origin theme
 * preview route in a frame of its own. The frame always lays the page out at a
 * desktop width — shrinking it with CSS would trip the phone rules and drop the
 * sign-in shell's illustration — and scales the finished viewport down to fit
 * the console. The overlay keeps the preview noninteractive: it cannot submit,
 * navigate, or reach the visitor's session.
 */
export function ApplicationAuthPreviewFrame({application, page, className}: ApplicationAuthPreviewFrameProps) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const applicationRef = React.useRef<unknown>(application);
  const [ready, setReady] = React.useState(false);
  const [width, setWidth] = React.useState(0);

  const postApplication = React.useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {type: ThemePreviewMessage, application: applicationRef.current},
      window.location.origin,
    );
  }, []);

  // once the handshake completes, every edit is pushed; the latest one is kept in
  // the ref so a ready that raced a prop change still sends the current value
  React.useEffect(() => {
    applicationRef.current = application;
    if (ready) {
      postApplication();
    }
  }, [application, ready, postApplication]);

  // registered in a layout effect so it is listening before the frame's document
  // can announce itself; a passive effect can run after a cached frame has loaded
  React.useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) {
        return;
      }
      if (event.data?.type === `${ThemePreviewMessage}-ready`) {
        setReady(true);
        postApplication();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postApplication]);

  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    setWidth(box.clientWidth);
    const observer = new ResizeObserver(() => setWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // the overlay swallows clicks; a wheel still scrolls the page it covers, so a
  // form taller than the frame stays reachable without making the frame usable
  React.useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      const contentWindow = frameRef.current?.contentWindow;
      if (!contentWindow) {
        return;
      }
      event.preventDefault();
      contentWindow.scrollBy(event.deltaX, event.deltaY);
    };
    overlay.addEventListener("wheel", onWheel, {passive: false});
    return () => overlay.removeEventListener("wheel", onWheel);
  }, []);

  const scale = width > 0 ? Math.min(1, width / DESKTOP_WIDTH) : 0;
  const height = width > 0 ? Math.round(DESKTOP_HEIGHT * scale) : undefined;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={boxRef}
        className="relative mx-auto w-full max-w-[1280px] overflow-hidden rounded-lg border bg-muted shadow-sm"
        style={height === undefined ? {aspectRatio: `${DESKTOP_WIDTH} / ${DESKTOP_HEIGHT}`} : {height}}
      >
        {scale > 0 ? (
          <iframe
            key={page}
            ref={frameRef}
            title={i18next.t("general:Preview")}
            src={`/marketplace/theme-preview?page=${page}`}
            tabIndex={-1}
            inert
            className="block origin-top-left border-0"
            style={{width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, transform: `scale(${scale})`}}
            onLoad={postApplication}
          />
        ) : null}
        {/* the preview is to look at, not to use */}
        <div ref={overlayRef} className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden="true" />
      </div>
    </div>
  );
}
