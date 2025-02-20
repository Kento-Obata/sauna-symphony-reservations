
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ShiftGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          navigate("/shift/login", { 
            replace: true,
            state: { from: location.pathname }
          });
          return;
        }

        if (!session) {
          setIsLoading(false);
          navigate("/shift/login", { 
            replace: true,
            state: { from: location.pathname }
          });
          return;
        }

        // Check profile and role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Profile error:", profileError);
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          setIsLoading(false);
          navigate("/shift/login", { 
            replace: true,
            state: { from: location.pathname }
          });
          return;
        }

        if (!['viewer', 'staff', 'admin'].includes(profile.role)) {
          toast.error("シフト管理画面へのアクセス権限がありません");
          await supabase.auth.signOut();
          setIsLoading(false);
          navigate("/shift/login", { 
            replace: true,
            state: { from: location.pathname }
          });
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("認証エラーが発生しました");
        await supabase.auth.signOut();
        setIsLoading(false);
        navigate("/shift/login", { 
          replace: true,
          state: { from: location.pathname }
        });
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          navigate("/shift/login", { 
            replace: true,
            state: { from: location.pathname }
          });
        } else {
          checkAuth();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return <>{children}</>;
};
