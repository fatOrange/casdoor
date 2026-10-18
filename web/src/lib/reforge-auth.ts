/** The page shapes the Reforge authentication shell can wrap. */
export type AuthPage =
  | "signin"
  | "signup"
  | "forget"
  | "prompt"
  | "consent"
  | "result"
  | "update-password"
  | "init-admin"
  | "callback"
  | "saml";

/**
 * Whether an application chose the Reforge page template in its UI
 * customization. Missing and unknown values keep the stock layout.
 */
export function isReforgeApplication(application: unknown): boolean {
  return typeof application === "object" &&
    application !== null &&
    "authTemplate" in application &&
    application.authTemplate === "reforge";
}
