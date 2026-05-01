import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "rgb(186, 192, 173)" }}>
      <Card className="max-w-md w-full p-8 space-y-4">
        <h1 className="text-xl font-bold text-center">メール配信停止</h1>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm text-muted-foreground">確認中...</p>
          </div>
        )}

        {state === "valid" && (
          <>
            <p className="text-sm text-center">
              {email && <strong>{email}</strong>} 宛のメール配信を停止します。よろしいですか？
            </p>
            <Button className="w-full" onClick={confirm}>配信停止を確定する</Button>
          </>
        )}

        {state === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm text-muted-foreground">処理中...</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <p className="text-sm text-center">配信停止が完了しました。</p>
          </div>
        )}

        {state === "already" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <p className="text-sm text-center">既に配信停止済みです。</p>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div className="flex flex-col items-center gap-3 py-6">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-center">{errorMsg || "リンクが無効または期限切れです。"}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
