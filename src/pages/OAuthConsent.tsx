import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Claudeアプリ等(MCP クライアント)が店舗管理に接続するときの同意画面。
// Supabase Auth の OAuth 2.1 サーバーが authorization_id を付けてここへ送ってくるので、
// 管理者でログインしていることを確かめてから、許可/拒否を Supabase Auth に伝える。

interface AuthorizationDetails {
  authorization_id?: string;
  redirect_url?: string;
  client?: { name?: string; uri?: string };
  scope?: string;
}

const authorizationEndpoint = (id: string) => `${SUPABASE_URL}/auth/v1/oauth/authorizations/${encodeURIComponent(id)}`;

const callAuth = async (url: string, accessToken: string, body?: unknown) => {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.msg ?? data?.error_description ?? `HTTP ${res.status}`);
  return data as AuthorizationDetails;
};

const OAuthConsent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = searchParams.get("authorization_id");
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authorizationId) {
      setError("接続の情報が見つかりません\u3000Claude からもう一度接続してください");
      return;
    }
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        navigate(`/admin/login?redirect=${encodeURIComponent(back)}`, { replace: true });
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, username").eq("id", session.user.id).single();
      if (profile?.role !== "admin") {
        setError("管理者のアカウントでログインしてください");
        return;
      }
      setAccountLabel(profile.username || session.user.email || "");
      setAccessToken(session.access_token);
      try {
        const result = await callAuth(authorizationEndpoint(authorizationId), session.access_token);
        // 以前に許可済みなら、確認なしでそのまま戻す
        if (result.redirect_url && !result.authorization_id) {
          window.location.assign(result.redirect_url);
          return;
        }
        setDetails(result);
      } catch (e) {
        console.error("OAuth authorization details error:", e);
        setError("この接続リクエストは期限が切れているか、無効です\u3000Claude からもう一度接続してください");
      }
    };
    load();
  }, [authorizationId, navigate]);

  const decide = async (action: "approve" | "deny") => {
    if (!authorizationId || !accessToken) return;
    setSubmitting(true);
    try {
      const result = await callAuth(`${authorizationEndpoint(authorizationId)}/consent`, accessToken, { action });
      if (result.redirect_url) window.location.assign(result.redirect_url);
    } catch (e) {
      console.error("OAuth consent error:", e);
      setError("処理できませんでした\u3000Claude からもう一度接続してください");
      setSubmitting(false);
    }
  };

  const clientName = details?.client?.name || "AIエージェント";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">U sauna 店舗管理</p>
          <h1 className="text-xl font-semibold">{error ? "接続できません" : `「${clientName}」からの接続`}</h1>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !details ? (
          <p className="text-center text-sm text-muted-foreground">読み込み中…</p>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{accountLabel}</span>（管理者）としてログイン中です。許可すると、このAIはあなたと同じ権限で次のことができます
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>予約・空き状況・休業の確認と変更</li>
                <li>シフト・給与・作業管理・ハーブの確認と変更</li>
                <li>お客様情報の確認</li>
              </ul>
              <p className="text-muted-foreground">返金やお客様への送信は、実行の前に必ずあなたの確認が入ります。許可はいつでも Claude の設定から外せます</p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={submitting} onClick={() => decide("approve")}>
                許可する
              </Button>
              <Button className="flex-1" variant="outline" disabled={submitting} onClick={() => decide("deny")}>
                許可しない
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthConsent;
