import type {MouseEvent} from "react";
import type {NavigateFunction} from "react-router-dom";

const TRANSITION_MARKER = "data-reforge-auth-transition";

/** the branded shell's own root, the ground truth for "the destination is ready": it
 *  renders only once the page's own data and initial language are on screen */
const SHELL_SELECTOR = ".reforge-auth";

/** Just under Chrome's hard-coded 4s update-callback watchdog: a destination that is
 *  later than that cannot animate anyway, and this run must settle by itself. */
const DESTINATION_TIMEOUT_MS = 3800;

export type ReforgeAuthPage = "signin" | "signup";

interface ReforgeTransitionApplication {
  name: string;
  organization?: string;
  clientId?: string;
  isShared?: boolean;
}

export interface ReforgeAuthTransitionOptions {
  navigate: NavigateFunction;
  application: ReforgeTransitionApplication;
  from: ReforgeAuthPage;
  enabled: boolean;
}

/** The members this module uses. lib.dom's ViewTransition and the one react-router-dom
 *  augments Document with disagree on the rest, and the call returns the latter. */
interface ReforgeViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

interface PendingDestination {
  timer: number;
  observer: MutationObserver;
  resolve: () => void;
}

let nextRunId = 0;
let activeRunId = 0;
let waitingFor: PendingDestination | null = null;

function releaseMarker(runId: number): void {
  if (activeRunId === runId) {
    document.documentElement.removeAttribute(TRANSITION_MARKER);
  }
}

function releaseWaiting(): void {
  const waiting = waitingFor;
  if (waiting === null) {
    return;
  }
  waitingFor = null;
  window.clearTimeout(waiting.timer);
  waiting.observer.disconnect();
  waiting.resolve();
}

function waitForDestination(page: ReforgeAuthPage, giveUp: () => void): Promise<void> {
  if (document.querySelector(`${SHELL_SELECTOR}[data-page="${page}"]`) !== null) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    releaseWaiting();
    const waiting: PendingDestination = {
      resolve,
      observer: new MutationObserver(() => {
        if (document.querySelector(`${SHELL_SELECTOR}[data-page="${page}"]`) !== null) {
          releaseWaiting();
        }
      }),
      timer: window.setTimeout(() => {
        if (waitingFor !== waiting) {
          return;
        }
        waitingFor = null;
        waiting.observer.disconnect();
        giveUp();
        resolve();
      }, DESTINATION_TIMEOUT_MS),
    };
    waiting.observer.observe(document.documentElement, {childList: true, subtree: true});
    waitingFor = waiting;
  });
}

function startReforgeTransition(navigate: NavigateFunction, url: string, page: ReforgeAuthPage): void {
  const runId = ++nextRunId;
  activeRunId = runId;
  const startedAt = window.location.pathname + window.location.search + window.location.hash;
  document.documentElement.setAttribute(TRANSITION_MARKER, "");

  let transition: ReforgeViewTransition;
  try {
    transition = document.startViewTransition(() => {
      if (runId !== activeRunId) {
        return undefined;
      }
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (current !== startedAt && current !== url) {
        return undefined;
      }
      if (current !== url) {
        navigate(url);
      }
      return waitForDestination(page, () => transition.skipTransition());
    });
  } catch {
    releaseMarker(runId);
    navigate(url);
    return;
  }

  // a skipped run rejects ready, and a rejected callback rejects the other two:
  // none of them may surface as unhandled
  void transition.ready.catch(() => {});
  void transition.updateCallbackDone.catch(() => {});
  void transition.finished.then(
    () => releaseMarker(runId),
    () => releaseMarker(runId),
  );
}

/**
 * Whether `target` opens `page` of this very application. Mirrors the URLs
 * Setting.getSignupLink() and Setting.getLoginLink() build for it: the signup's named
 * forms, and both OAuth forms when the `client_id` is this application's own.
 */
function isReforgeDestination(target: URL, page: ReforgeAuthPage, application: ReforgeTransitionApplication): boolean {
  const clientId = target.searchParams.get("client_id");
  const ownOAuthForm = clientId !== null && (clientId === application.clientId || clientId === application.name);
  if (page === "signup") {
    return target.pathname === `/signup/${application.name}` ||
      (!!application.isShared && target.pathname === `/signup/${application.name}-org-${application.organization}`) ||
      (ownOAuthForm && target.pathname === "/signup/oauth/authorize");
  }
  return ownOAuthForm && target.pathname === "/login/oauth/authorize";
}

export function handleReforgeAuthTransitionClick(
  event: MouseEvent<HTMLAnchorElement>,
  {navigate, application, from, enabled}: ReforgeAuthTransitionOptions,
): void {
  if (!enabled || typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (event.defaultPrevented || event.button !== 0) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const anchor = event.currentTarget;
  if (anchor.target && anchor.target !== "_self") {
    return;
  }
  if (anchor.hasAttribute("download")) {
    return;
  }
  if (anchor.closest(SHELL_SELECTOR) === null) {
    return;
  }

  let target: URL | null = null;
  try {
    target = new URL(anchor.href, window.location.href);
  } catch {
    return;
  }
  const page: ReforgeAuthPage = from === "signin" ? "signup" : "signin";
  if (target === null || target.origin !== window.location.origin || !isReforgeDestination(target, page, application)) {
    return;
  }

  event.preventDefault();
  startReforgeTransition(navigate, target.pathname + target.search + target.hash, page);
}
