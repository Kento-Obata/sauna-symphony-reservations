import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const ShiftLogin = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN") {
          // Check if user has staff or admin role
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session?.user?.id)
            .single();

          if (profile?.role === "staff" || profile?.role === "admin" || profile?.role === "viewer") {
            navigate("/shift");
          } else {
            setErrorMessage("スタッフ権限がありません。");
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
    setErrorMessage(""); // Clear any previous error messages

    try {
      const email = `${username}@example.com`;
      console.log("Attempting login with:", { email, passwordLength: password.length });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

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
        setErrorMessage("ログインに失敗しました。");
        return;
      }

      // Success case is handled by the onAuthStateChange listener
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage("ログインに失敗しました。");
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
            />
          </div>
          <Button type="submit" className="w-full">
            ログイン
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ShiftLogin;