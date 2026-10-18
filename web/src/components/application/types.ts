/** The page template persisted in an application's `authTemplate` field. */
export type AuthTemplate = "default" | "reforge";

/** The application fields this module owns; other fields pass through untouched. */
export interface Application {
  authTemplate?: AuthTemplate;
}

/**
 * The effective template: a missing or unknown `authTemplate` means the default
 * one, which is also what applications saved before the field existed get.
 */
export function getAuthTemplate(application: Application | null | undefined): AuthTemplate {
  return application?.authTemplate === "reforge" ? "reforge" : "default";
}

/** every tab of the application edit page writes back through the same setter */
export interface ApplicationTabProps {
  application: any;
  updateField: (field: string, value: any) => void;
}

/** how the edit page lays its tabs out: across the top, or down the left side */
export type MenuMode = "horizontal" | "vertical";
