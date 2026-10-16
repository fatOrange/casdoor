import * as React from "react";
import i18next from "i18next";
import {ArrowLeft} from "lucide-react";
import {useLanguage} from "@/hooks/use-language";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";
import "./reforge-auth.css";

const ILLUSTRATION_URL = "/oneprep/great-wave.webp";
const TERMS_OF_SERVICE_URL = "https://www.oneprep.xyz/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.oneprep.xyz/privacy-policy";

/** this flow's own language, so no other application's pick leaks in */
const SIGNIN_LANGUAGE_KEY = "reforgeSigninLanguage";

/** the reference pages are English */
const DEFAULT_LANGUAGE = "en";

// The sign-in and the sign-up page share one flow lifecycle: the language and the
// shared `signinLanguage` value the visitor arrived with go back when the last
// shell unmounts. A same-tick swap between the two pages is not a leave — the
// restore waits for a microtask, by which time the next shell has mounted.
let shells = 0;
let flowLanguage = "";
let flowSigninLanguage = "";
let restoreScheduled = false;
let bodyHadThemeScope = false;
let bodyHadMarker = false;

function enterFlow() {
  // a shell that returns in the same tick continues the flow it just left
  if (shells === 0 && !restoreScheduled) {
    flowLanguage = i18next.language;
    flowSigninLanguage = Setting.getSigninLanguage();
    // portaled menus and dialogs hang off <body>, outside the shell's own scope,
    // so the light palette (pinned by reforge-auth.css) is lent to the body for
    // the length of the flow
    bodyHadThemeScope = document.body.classList.contains("theme-scope-light");
    bodyHadMarker = document.body.classList.contains("reforge-auth-active");
    document.body.classList.add("theme-scope-light", "reforge-auth-active");
  }
  shells += 1;
}

function leaveFlow() {
  shells -= 1;
  if (shells > 0 || restoreScheduled) {
    return;
  }
  restoreScheduled = true;
  queueMicrotask(() => {
    restoreScheduled = false;
    if (shells > 0) {
      return;
    }
    if (i18next.language !== flowLanguage) {
      void i18next.changeLanguage(flowLanguage);
    }
    Setting.setSigninLanguage(flowSigninLanguage);
    if (!bodyHadThemeScope) {
      document.body.classList.remove("theme-scope-light");
    }
    if (!bodyHadMarker) {
      document.body.classList.remove("reforge-auth-active");
    }
  });
}

interface ReforgeAuthApplication {
  organizationObj?: {languages?: string[]};
}

interface ReforgeAuthLayoutProps {
  application?: ReforgeAuthApplication;
  authPage: "signin" | "signup";
  children: React.ReactNode;
  className?: string;
  /** the row shown at the bottom of the card */
  footer?: React.ReactNode;
  onLanguageChange?: (key: string) => void;
  onBack?: () => void;
  /** the console's own preview of this page: the shell then leaves the console's
   *  language and its sessionStorage keys alone */
  preview?: boolean;
}

/** The application's languages, in the order the console lists them. */
function getLanguageOptions(application: ReforgeAuthApplication | undefined) {
  const allowed = application?.organizationObj?.languages ?? [];
  return Setting.Countries.filter((country) => allowed.length === 0 || allowed.includes(country.key));
}

/** This flow's remembered language, English when there is none or it is not offered. */
function getInitialLanguage(options: {key: string}[]): string {
  const keys = options.map((option) => option.key);
  const preferred = sessionStorage.getItem(SIGNIN_LANGUAGE_KEY) ?? "";
  if (preferred !== "" && keys.includes(preferred)) {
    return preferred;
  }
  return keys.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : (keys[0] ?? DEFAULT_LANGUAGE);
}

/**
 * The Zhikaoya-branded shell around the reforge pages' own form markup. It owns
 * the flow language: the form mounts only once the initial language is on
 * screen, picks are parked under this app's own sessionStorage key, and the
 * visitor's language (with the shared `signinLanguage`) comes back on the way out.
 */
export function ReforgeAuthLayout({
  application,
  authPage,
  children,
  className,
  footer,
  onLanguageChange,
  onBack,
  preview,
}: ReforgeAuthLayoutProps) {
  const language = useLanguage();
  const languages = getLanguageOptions(application);
  const [initialLanguage] = React.useState(() => getInitialLanguage(languages));
  const [started, setStarted] = React.useState(() => !!preview || language === initialLanguage);
  // set once the visitor picks with the control, after which nothing is enforced
  const picked = React.useRef(false);

  React.useLayoutEffect(() => {
    if (preview) {
      return undefined;
    }
    enterFlow();
    return leaveFlow;
  }, [preview]);

  // The form mounts only once this flow's language is on screen; the switch is
  // re-asserted until it lands, as StrictMode's simulated remount resets it.
  React.useLayoutEffect(() => {
    if (preview || language === initialLanguage) {
      if (!started) {
        setStarted(true);
      }
      return;
    }
    if (!picked.current) {
      i18next.changeLanguage(initialLanguage).catch(() => setStarted(true));
    }
  }, [preview, started, language, initialLanguage]);

  if (!started) {
    return null;
  }

  const pickLanguage = (key: string) => {
    if (key === language) {
      return;
    }
    picked.current = true;
    sessionStorage.setItem(SIGNIN_LANGUAGE_KEY, key);
    // the shared key still feeds the provider redirects and the created user
    Setting.setSigninLanguage(key);
    void i18next.changeLanguage(key);
    onLanguageChange?.(key);
  };

  const picker =
    !preview && languages.length > 1 ? (
      <div className="reforge-auth-topbar">
        <select
          className="reforge-auth-lang-select"
          aria-label={i18next.t("user:Language")}
          value={languages.some((option) => option.key === language) ? language : initialLanguage}
          onChange={(event) => pickLanguage(event.target.value)}
        >
          {languages.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const and = i18next.t("reforge:and");

  return (
    <div className="reforge-auth theme-scope-light" data-page={authPage}>
      <div className="reforge-auth-page">
        <div className="reforge-auth-background">
          {picker}
          <div className="reforge-auth-content">
            <div className="reforge-auth-header">
              <div className="reforge-auth-logo" role="img" aria-label="LOGO">
                LOGO
              </div>
              <h1 className="reforge-auth-heading">
                {authPage === "signin" ? "登录智考鸭" : i18next.t("reforge:Sign up")}
              </h1>
            </div>
            <div className="reforge-auth-card">
              {onBack ? (
                <button type="button" className="reforge-auth-back" aria-label={i18next.t("general:Back")} onClick={onBack}>
                  <ArrowLeft aria-hidden="true" />
                </button>
              ) : null}
              <div className={cn("reforge-auth-form", className)}>{children}</div>
              {footer ? <div className="reforge-auth-footer">{footer}</div> : null}
            </div>
          </div>
          <small className="reforge-auth-legal">
            {authPage === "signup" ? (
              <>
                {i18next.t("reforge:By creating an account, you agree to the")}
                <br />
              </>
            ) : null}
            <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noopener noreferrer">
              {i18next.t("reforge:Terms of Service")}
            </a>
            {` ${and} `}
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
              {i18next.t("reforge:Privacy Policy")}
            </a>
          </small>
        </div>
        {authPage === "signin" ? (
          <div className="reforge-auth-illustration">
            <div className="reforge-auth-illustration-inner">
              <img src={ILLUSTRATION_URL} alt="Hokusai's The Great Wave off Kanagawa" decoding="async" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
