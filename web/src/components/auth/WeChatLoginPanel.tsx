import * as React from "react";
import i18next from "i18next";
import {QRCodeSVG} from "qrcode.react";
import {cn} from "@/lib/utils";
import {Loading} from "@/components/common/Loading";
import * as AuthBackend from "@/backend/AuthBackend";
import * as Util from "@/auth/Util";

/** One entry of `application.providers`; only the WeChat provider's id is read from it. */
interface WeChatProviderItem {
  provider?: {type: string; owner: string; name: string};
}

/** The `/api/get-qrcode` payload: data is the QR content, data2 the ticket the scan poll reads. */
interface WeChatQrResponse {
  status: string;
  data?: string;
  data2?: string;
}

/**
 * The WeChat QR panel of the sign-in page, ported from
 * web/src/auth/WeChatLoginPanel.js: it fetches a QR code for the application's
 * WeChat provider and polls the scan event once a second.
 */
export function WeChatLoginPanel({application}: {application?: {providers?: WeChatProviderItem[]}}) {
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  const providers: WeChatProviderItem[] = application?.providers ?? [];
  const provider = providers.find((item) => item.provider?.type === "WeChat")?.provider;

  React.useEffect(() => {
    if (!provider) {
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    setQrCode(null);
    setExpired(false);

    AuthBackend.getWechatQRCode(`${provider.owner}/${provider.name}`)
      .then((res: WeChatQrResponse) => {
        if (cancelled) {
          return;
        }
        if (res.status === "ok" && res.data) {
          setQrCode(res.data);
          timer = window.setInterval(() => {
            Util.getEvent(application, provider, res.data2, "signup");
          }, 1000);
        } else {
          setExpired(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExpired(true);
        }
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [provider, application, nonce]);

  if (!provider) {
    return null;
  }

  const waiting = !qrCode && !expired;

  return (
    <div className="mx-auto flex flex-col items-center gap-3 pt-4">
      {/* the reserved 230x230 slot keeps the card's height steady while the code is fetched, shown or refused */}
      <div className="wechat-qr-slot flex h-[230px] w-[230px] items-center justify-center">
        {qrCode ? (
          <div className={cn("wechat-qr-code", expired && "opacity-30")}>
            <QRCodeSVG value={qrCode} size={230} />
          </div>
        ) : waiting ? (
          <div
            className="wechat-qr-loading"
            role="status"
            aria-busy="true"
            aria-label={i18next.t("general:QR Code")}
          >
            <Loading className="w-auto py-0" />
          </div>
        ) : (
          /* the fetch failed: an empty slot, the Refresh link below retries */
          <div className="wechat-qr-empty h-full w-full rounded-lg border border-dashed border-muted-foreground/40" />
        )}
      </div>
      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setNonce((n) => n + 1)}
      >
        {i18next.t("general:Refresh")}
      </button>
    </div>
  );
}
