import * as React from "react";
import i18next from "i18next";
import {ArrowLeft} from "lucide-react";
import {CustomHtml, CustomStyle} from "@/components/common/CustomHtml";
import {ThemeToggle} from "@/components/common/ThemeToggle";
import {PoweredBy} from "@/components/layout/PoweredBy";
import {useLanguage} from "@/hooks/use-language";
import {useIsMobile} from "@/hooks/use-mobile";
import type {AuthPage} from "@/lib/reforge-auth";
import {getSafeHtml} from "@/lib/custom-html";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";
import "./reforge-auth.css";

const ILLUSTRATION_URL = "/oneprep/great-wave.webp";

/** this flow's own language, so no other application's pick leaks in */
const SIGNIN_LANGUAGE_KEY = "reforgeSigninLanguage";

/** the reference pages are English */
const DEFAULT_LANGUAGE = "en";

// The pages of a template share one flow lifecycle: the language and the shared
// `signinLanguage` value the visitor arrived with go back when the last shell
// unmounts. A same-tick swap between two pages is not a leave — the restore waits
// for a microtask, by which time the next shell has mounted.
let shells = 0;
let flowLanguage = "";
let flowSigninLanguage = "";
let restoreScheduled = false;
let bodyHadMarker = false;

function enterFlow() {
  // a shell that returns in the same tick continues the flow it just left
  if (shells === 0 && !restoreScheduled) {
    flowLanguage = i18next.language;
    flowSigninLanguage = Setting.getSigninLanguage();
    // the marker scopes the sign-in ↔ sign-up view transition
    bodyHadMarker = document.body.classList.contains("reforge-auth-active");
    document.body.classList.add("reforge-auth-active");
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
    if (!bodyHadMarker) {
      document.body.classList.remove("reforge-auth-active");
    }
  });
}

interface ReforgeAuthApplication {
  organizationObj?: {languages?: string[]};
  displayName?: string;
  name?: string;
  homepageUrl?: string;
}

interface ReforgeAuthLayoutProps {
  application?: ReforgeAuthApplication;
  authPage: AuthPage;
  /** the page's own h1; `null` keeps the page content's heading instead */
  heading?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** the row shown at the bottom of the card */
  footer?: React.ReactNode;
  hideLogo?: boolean;
  hideLanguages?: boolean;
  onLanguageChange?: (key: string) => void;
  onBack?: () => void;
  /** the console's own preview of this page: the shell then leaves the console's
   *  language, sessionStorage keys and transition marker alone */
  preview?: boolean;
  /** the editor's fixed-height frame: the shell fills it and starts at the top
   *  instead of centring itself in the browser viewport */
  bounded?: boolean;
  /** the application chrome, resolved once by AuthLayout */
  logo: string;
  formCss?: string;
  backgroundUrl?: string;
  /** formOffset: 1 left, 2 center, 3 right, 4 center with the side panel */
  offset?: number;
  /** the configured side panel, shown where the stock layout shows it too */
  sidePanel?: string;
  footerHtml?: string;
  trusted?: boolean;
  /** an embedded page keeps its host's background and stylesheet */
  embedded?: boolean;
  /** the application's own form CSS paints a light panel inside a dark page */
  panelIsLight?: boolean;
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

/** The heading of a page whose content does not carry one of its own. */
function getDefaultHeading(authPage: AuthPage) {
  switch (authPage) {
  case "signup":
    return i18next.t("account:Sign Up");
  case "forget":
    return i18next.t("forget:Change Password");
  case "prompt":
    return i18next.t("application:Binding providers");
  case "consent":
    return i18next.t("consent:Authorization Request");
  case "result":
    return i18next.t("signup:Your account has been created!");
  case "update-password":
    return i18next.t("user:You need to update your password");
  case "init-admin":
    return i18next.t("login:Welcome to Casdoor");
  default:
    return i18next.t("login:Sign In");
  }
}

/**
 * The Reforge shell around an application's own form markup. It follows the
 * application's theme, branding, language and customization (offset, background,
 * side panel, footer) while keeping the stock auth class names available to the
 * application's own CSS.
 */
export function ReforgeAuthLayout({
  application,
  authPage,
  heading,
  children,
  className,
  footer,
  hideLogo,
  hideLanguages,
  onLanguageChange,
  onBack,
  preview,
  bounded,
  logo,
  formCss,
  backgroundUrl,
  offset = 2,
  sidePanel,
  footerHtml,
  trusted = false,
  embedded = false,
  panelIsLight = false,
}: ReforgeAuthLayoutProps) {
  const language = useLanguage();
  const isMobile = useIsMobile();
  const languages = getLanguageOptions(application);
  const syncLanguage = !preview && !hideLanguages;
  const [initialLanguage] = React.useState(() => syncLanguage ? getInitialLanguage(languages) : language);
  const [started, setStarted] = React.useState(() => !syncLanguage || language === initialLanguage);
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
    if (!syncLanguage || language === initialLanguage) {
      if (!started) {
        setStarted(true);
      }
      return;
    }
    if (!picked.current) {
      i18next.changeLanguage(initialLanguage).catch(() => setStarted(true));
    }
  }, [syncLanguage, started, language, initialLanguage]);

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

  const languagePicker =
    !preview && !hideLanguages && languages.length > 1 ? (
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
    ) : null;

  const headingNode = heading === undefined ? getDefaultHeading(authPage) : heading;
  const logoImage = (
    <img
      src={logo}
      alt={application?.displayName || application?.name || "Casdoor"}
      className="reforge-auth-logo-image"
    />
  );
  const showHeader = !hideLogo || headingNode !== null;
  // the stock layout shows a side panel only at offset 4; everything else keeps
  // the reference illustration on the sign-in page, where the reference has one
  const secondary = sidePanel ? "side" : authPage === "signin" ? "illustration" : "none";
  const effectiveOffset = offset === 4 && !sidePanel ? 2 : offset;

  return (
    <div
      className={cn(
        "reforge-auth",
        // index.css pins .login-background to 100dvh, which the editor's frame must not inherit
        !bounded && "login-background",
        bounded && "reforge-auth-preview",
        backgroundUrl && cn("bg-cover bg-center", isMobile || bounded ? "bg-scroll" : "bg-fixed"),
      )}
      style={backgroundUrl ? {backgroundImage: `url(${backgroundUrl})`} : undefined}
      data-page={authPage}
      data-offset={effectiveOffset}
      data-secondary={secondary}
    >
      {embedded ? null : <CustomStyle css={formCss} />}

      <div className="reforge-auth-page">
        <div className="reforge-auth-background">
          <div className="reforge-auth-topbar login-topbar">
            {languagePicker}
            <ThemeToggle className="reforge-auth-theme-toggle" />
          </div>

          <div className="reforge-auth-content login-content">
            {showHeader ? (
              <div className="reforge-auth-header">
                {hideLogo ? null : (
                  <div className="reforge-auth-logo login-logo-box">
                    {application?.homepageUrl ? (
                      <a
                        href={application.homepageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="reforge-auth-logo-link"
                      >
                        {logoImage}
                      </a>
                    ) : (
                      logoImage
                    )}
                  </div>
                )}
                {headingNode === null ? null : <h1 className="reforge-auth-heading">{headingNode}</h1>}
              </div>
            ) : null}

            <div className={cn(
              "reforge-auth-card login-panel",
              panelIsLight && "theme-scope-light",
            )}>
              {onBack ? (
                <button type="button" className="reforge-auth-back" aria-label={i18next.t("general:Back")} onClick={onBack}>
                  <ArrowLeft aria-hidden="true" />
                </button>
              ) : null}
              <div className={cn("reforge-auth-form login-form", className)}>{children}</div>
              {footer ? <div className="reforge-auth-footer">{footer}</div> : null}
            </div>
          </div>
        </div>

        {secondary === "none" || bounded ? null : (
          <div className="reforge-auth-illustration" aria-hidden={secondary === "illustration" ? true : undefined}>
            <div className="reforge-auth-illustration-inner">
              {secondary === "side" ? (
                <CustomHtml html={sidePanel} trusted={trusted} className="reforge-auth-side-html side-image" />
              ) : (
                <img src={ILLUSTRATION_URL} alt="" decoding="async" />
              )}
            </div>
          </div>
        )}
      </div>

      {footerHtml ? (
        <footer
          id="footer"
          className="reforge-auth-page-footer"
          dangerouslySetInnerHTML={{__html: getSafeHtml(footerHtml, trusted)}}
        />
      ) : (
        <footer id="footer" className="reforge-auth-page-footer">
          <PoweredBy />
        </footer>
      )}
    </div>
  );
}
