import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ShiftLogin = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      console.log("Checking session...");
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("Session check result:", { session, error: sessionError });
        
        if (sessionError) {
          console.error("Session check error:", sessionError);
          return;
        }
        
        if (session?.user) {
          console.log("Found existing session:", session.user.email);
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          console.log("Profile check result:", { profile, error: profileError });

          if (profileError) {
            console.error("Error fetching profile:", profileError);
            return;
          }

          if (profile?.role && ["staff", "admin", "viewer"].includes(profile.role)) {
            console.log("Valid role found, navigating to /shift");
            navigate("/shift");
          }
        }
      } catch (error) {
        console.error("Unexpected error during session check:", error);
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    console.log("Setting up auth state change listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", { event, email: session?.user?.email });
        if (event === "SIGNED_IN" && session?.user?.id) {
          try {
            console.log("Fetching profile for user:", session.user.id);
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .single();

            console.log("Profile fetch result:", { profile, error: profileError });

            if (profileError) {
              console.error("Error fetching profile:", profileError);
              setErrorMessage("プロフィールの取得に失敗しました。");
              await supabase.auth.signOut();
              return;
            }

            if (!profile?.role) {
              console.error("No role found in profile");
              setErrorMessage("プロフィールが見つかりません。");
              await supabase.auth.signOut();
              return;
            }

            if (!["staff", "admin", "viewer"].includes(profile.role)) {
              console.error("Invalid role:", profile.role);
              setErrorMessage("アクセス権限がありません。");
              await supabase.auth.signOut();
              return;
            }

            console.log("Navigating to /shift");
            navigate("/shift");
          } catch (error) {
            console.error("Error in auth state change:", error);
            setErrorMessage("認証エラーが発生しました。");
            await supabase.auth.signOut();
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      if (!username || !password) {
        setErrorMessage("ユーザー名とパスワードを入力してください。");
        return;
      }

      const email = `${username}@u-sync.jp`;
      console.log("Attempting login with:", { email, passwordLength: password.length });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      console.log("Login attempt result:", { data, error });

      if (error) {
        console.error("Login error:", error);
        setErrorMessage(
          "ログインに失敗しました。ユーザー名とパスワードを確認してください。\n" +
          "※ユーザー名は大文字小文字を区別します。"
        );
        toast({
          variant: "destructive",
          title: "エラー",
          description: "ログインに失敗しました。",
        });
        return;
      }

      if (!data.user) {
        console.error("No user data returned");
        setErrorMessage("ログインに失敗しました。");
        return;
      }

    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("ログインに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-3xl font-bold mb-8">スタッフログイン</h1>
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="whitespace-pre-line">{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
              placeholder="ユーザー名を入力"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="パスワードを入力"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ログイン中...
              </>
            ) : (
              'ログイン'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ShiftLogin;