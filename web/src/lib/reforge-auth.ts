// The one application whose auth pages carry the OnePrep branding. Matched on the
// exact organization/name pair: a copy of the application under another name, or
// another organization's application of the same name, keeps the stock layout.
export function isReforgeApplication(application: unknown): boolean {
  if (typeof application !== "object" || application === null) {
    return false;
  }
  const organization = "organization" in application ? application.organization : undefined;
  const name = "name" in application ? application.name : undefined;
  return organization === "organization_dm01" && name === "dm01-reforge-login";
}
