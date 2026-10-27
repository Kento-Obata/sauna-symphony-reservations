import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Check, X } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (data.alreadyUnsubscribed || data.already_unsubscribed) {
          setEmail(data.email ?? "");
          setState("already");
        } else if (data.valid || data.email) {
          setEmail(data.email ?? "");
          setState("valid");
        } else {
          setErrorMsg(data.error ?? "リンクが無効です");
          setState("invalid");
        }
      } catch (e: any) {
        setErrorMsg(e?.message ?? "エラーが発生しました");
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.unsubscribed)) {
        setState("success");
      } else {
        setErrorMsg(data.error ?? "登録解除に失敗しました");
        setState("error");
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "エラーが発生しました");
      setState("error");
    }
  };

  const Icon = ({ tone }: { tone: "ok" | "ng" }) => (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-full ${tone === "ok" ? "bg-u-ink text-u-copper" : "border border-u-ink/25"}`}
      style={{ animation: "u-pop .6s var(--u-ease) both" }}
    >
      {tone === "ok" ? <Check className="h-6 w-6" strokeWidth={1.6} /> : <X className="h-6 w-6" strokeWidth={1.4} />}
    </span>
  );

  return (
    <SiteShell minimalFooter>
      <div className="u-container flex justify-center py-16 md:py-24">
        <div className="w-full max-w-md text-center" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
          <p className="u-latin text-xl italic text-u-ink/70">Unsubscribe</p>
          <h1 className="u-mincho mt-2 text-2xl tracking-[0.1em]">メール配信停止</h1>

          <div className="mt-10 rounded-[1.75rem] bg-u-paper p-8 shadow-[0_40px_80px_-50px_rgba(27,28,25,0.5)]">
            {state === "loading" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-6 w-6 animate-spin text-u-ink/70" />
                <p className="text-sm text-u-ink/70">確認中...</p>
              </div>
            )}

            {state === "valid" && (
              <>
                <p className="text-sm leading-[2]">
                  {email && <strong className="block break-all font-medium">{email}</strong>}
                  宛のメール配信を停止します。よろしいですか？
                </p>
                <button type="button" className="u-btn u-btn-primary mt-6 w-full" onClick={confirm}>
                  配信停止を確定する
                </button>
              </>
            )}

            {state === "submitting" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-6 w-6 animate-spin text-u-ink/70" />
                <p className="text-sm text-u-ink/70">処理中...</p>
              </div>
            )}

            {state === "success" && (
              <div className="flex flex-col items-center gap-4 py-4">
                <Icon tone="ok" />
                <p className="text-sm">配信停止が完了しました</p>
              </div>
            )}

            {state === "already" && (
              <div className="flex flex-col items-center gap-4 py-4">
                <Icon tone="ok" />
                <p className="text-sm">既に配信停止済みです</p>
              </div>
            )}

            {(state === "invalid" || state === "error") && (
              <div className="flex flex-col items-center gap-4 py-4">
                <Icon tone="ng" />
                <p className="text-sm">{errorMsg || "リンクが無効または期限切れです"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
