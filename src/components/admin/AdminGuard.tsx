import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard = ({ children }: AdminGuardProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          navigate("/admin/login", { replace: true });
          return;
        }

        if (!session) {
          navigate("/admin/login", { replace: true });
          return;
        }

        // Then check the profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          navigate("/admin/login", { replace: true });
          return;
        }

        // viewer権限のユーザーは/shiftにリダイレクト
        if (profile?.role === 'viewer') {
          navigate("/shift", { replace: true });
          return;
        }

        // admin以外の権限は/admin/loginにリダイレクト
        if (!profile || profile.role !== 'admin') {
          console.error("Insufficient permissions");
          toast.error("管理者権限がありません");
          await supabase.auth.signOut();
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          navigate("/admin/login", { replace: true });
        } else {
          checkAuth();
        }
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