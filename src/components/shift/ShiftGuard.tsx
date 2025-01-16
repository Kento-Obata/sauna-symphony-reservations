import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ShiftGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No session found, redirecting to login");
          navigate("/shift/login", { replace: true });
          return;
        }

        console.log("Session found, checking profile for user:", session.user.id);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          navigate("/shift/login", { replace: true });
          return;
        }

        console.log("Profile retrieved:", profile);

        // Check if user has appropriate role
        if (!profile || !['viewer', 'staff', 'admin'].includes(profile.role)) {
          console.error("Insufficient permissions. User role:", profile?.role);
          toast.error("シフト管理画面へのアクセス権限がありません");
          await supabase.auth.signOut();
          navigate("/shift/login", { replace: true });
          return;
        }

        console.log("User has appropriate permissions with role:", profile.role);
        // If we reach here, user has appropriate permissions
        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("認証エラーが発生しました");
        await supabase.auth.signOut();
        navigate("/shift/login", { replace: true });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        navigate("/shift/login", { replace: true });
      } else if (event === 'SIGNED_IN') {
        checkAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <>{children}</>;
};