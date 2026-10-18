import * as React from "react";
import {getSafeHtml} from "@/lib/custom-html";
import {ThemePreviewMessage} from "@/lib/integration";
import * as Setting from "@/lib/setting";

const LoginPage = React.lazy(() => import("@/pages/auth/LoginPage"));
const SignupPage = React.lazy(() => import("@/pages/auth/SignupPage"));
const PromptPage = React.lazy(() => import("@/pages/auth/PromptPage"));

type PreviewPage = "signin" | "signup" | "prompt";
type PreviewApplication = Record<string, unknown>;

function getPreviewPage(): PreviewPage {
  const page = new URLSearchParams(window.location.search).get("page");
  return page === "signup" || page === "prompt" ? page : "signin";
}

function sanitizeHtml(html: unknown): string | undefined {
  return typeof html === "string" && html !== "" ? getSafeHtml(html, false) : undefined;
}

/**
 * Custom sign-in items keep their HTML in `customCss`, custom sign-up items in
 * `label`; every other item's `customCss` is a stylesheet and must stay as it is.
 */
function sanitizeCustomItems(items: unknown, field: "customCss" | "label"): unknown {
  if (!Array.isArray(items)) {
    return items;
  }
  const entries: unknown[] = items;
  return entries.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item) || !Setting.isCustomFormItem(item)) {
      return item;
    }
    const entry = item as PreviewApplication;
    const html = entry[field];
    if (typeof html !== "string" || html === "") {
      return item;
    }
    return {...entry, [field]: getSafeHtml(html, false)};
  });
}

/**
 * The console sends the application it is editing; the frame renders it as the
 * visitor's page. <script> tags are re-created by the trusted HTML paths, and this
 * page is embedded in the console, so scripts are stripped from a preview-only
 * copy. The application's identity, theme and visual markup stay untouched.
 */
function getPreviewApplication(application: unknown): PreviewApplication | null {
  if (typeof application !== "object" || application === null || Array.isArray(application)) {
    return null;
  }
  // the verified message comes from this console's own frame, always an application object
  const applicationData = application as PreviewApplication;
  return {
    ...applicationData,
    signinHtml: sanitizeHtml(applicationData.signinHtml),
    signupHtml: sanitizeHtml(applicationData.signupHtml),
    headerHtml: sanitizeHtml(applicationData.headerHtml),
    pageHtml: sanitizeHtml(applicationData.pageHtml),
    formSideHtml: sanitizeHtml(applicationData.formSideHtml),
    footerHtml: sanitizeHtml(applicationData.footerHtml),
    signinItems: sanitizeCustomItems(applicationData.signinItems, "customCss"),
    signupItems: sanitizeCustomItems(applicationData.signupItems, "label"),
  };
}

/**
 * The auth page of an application the console is editing, shown in a frame of
 * its own. `?page=` picks which page; the Marketplace's preview keeps using the
 * default sign-in page. The application comes from the console that embeds this
 * page, never from the URL.
 */
export default function ThemePreviewPage() {
  const [application, setApplication] = React.useState<Record<string, unknown> | null>(null);
  const page = React.useMemo(getPreviewPage, []);

  // an auth page runs autoFocus on mount; making the whole preview document
  // inert first keeps focus (and Escape) in the console dialog that embeds it
  React.useLayoutEffect(() => {
    const body = document.body;
    const wasInert = body.inert;
    body.inert = true;
    return () => {
      body.inert = wasInert;
    };
  }, []);

  React.useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) {
        return;
      }
      if (event.data?.type === ThemePreviewMessage) {
        setApplication(getPreviewApplication(event.data.application));
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({type: `${ThemePreviewMessage}-ready`}, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!application) {
    return null;
  }
  return (
    <div inert className="min-h-screen">
      <React.Suspense fallback={null}>
        {page === "signup" ? (
          <SignupPage application={application} preview="theme" />
        ) : page === "prompt" ? (
          <PromptPage application={application} preview="theme" />
        ) : (
          <LoginPage type="login" application={application} preview="theme" />
        )}
      </React.Suspense>
    </div>
  );
}
