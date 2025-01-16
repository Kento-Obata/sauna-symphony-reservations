import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ShiftGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsLoading(false);
        navigate("/shift/login", { replace: true });
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          setIsLoading(false);
          navigate("/shift/login", { replace: true });
          return;
        }

        if (!['viewer', 'staff', 'admin'].includes(profile.role)) {
          toast.error("シフト管理画面へのアクセス権限がありません");
          await supabase.auth.signOut();
          setIsLoading(false);
          navigate("/shift/login", { replace: true });
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("認証エラーが発生しました");
        await supabase.auth.signOut();
        setIsLoading(false);
        navigate("/shift/login", { replace: true });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate("/shift/login", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return <>{children}</>;
};