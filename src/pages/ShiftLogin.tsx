import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthError } from "@supabase/supabase-js";

const ShiftLogin = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

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

          if (profile?.role === "staff" || profile?.role === "admin") {
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-3xl font-bold mb-8">スタッフログイン</h1>
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          localization={{
            variables: {
              sign_in: {
                email_label: "メールアドレス",
                password_label: "パスワード",
                button_label: "ログイン",
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default ShiftLogin;