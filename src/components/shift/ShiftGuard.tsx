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
          navigate("/shift/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          navigate("/shift/login");
          return;
        }

        if (!profile || !['viewer', 'staff', 'admin'].includes(profile.role)) {
          toast.error("アクセス権限がありません");
          await supabase.auth.signOut();
          navigate("/shift/login");
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/shift/login");
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        navigate("/shift/login");
      } else if (event === "SIGNED_IN") {
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