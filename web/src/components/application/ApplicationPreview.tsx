import {ApplicationAuthPreviewFrame} from "@/components/application/ApplicationAuthPreviewFrame";
import * as Setting from "@/lib/setting";

/**
 * The sign-up and sign-in pages side by side, rendered from the application the
 * editor currently holds — not from the saved one. Each side is a full desktop
 * viewport of the real auth page, scaled to fit; the shared frame is
 * noninteractive, so clicking the preview cannot submit a form or navigate.
 */
export function ApplicationSignupSigninPreview({application}: {application: unknown}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* without a password form there is no sign-up form either, so the antd
          preview shows the sign-in page in its place */}
      <ApplicationAuthPreviewFrame
        application={application}
        page={Setting.isPasswordEnabled(application) ? "signup" : "signin"}
      />
      <ApplicationAuthPreviewFrame application={application} page="signin" />
    </div>
  );
}

export function ApplicationPromptPreview({application}: {application: unknown}) {
  return (
    <div className="xl:max-w-[50%]">
      <ApplicationAuthPreviewFrame application={application} page="prompt" />
    </div>
  );
}
