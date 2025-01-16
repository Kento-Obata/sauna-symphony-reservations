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
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error("ログインが必要です");
          navigate("/admin/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          toast.error("プロフィールの取得に失敗しました");
          await supabase.auth.signOut();
          navigate("/admin/login");
          return;
        }

        if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
          toast.error("管理者または従業員権限がありません");
          await supabase.auth.signOut();
          navigate("/admin/login");
          return;
        }

        setUserRole(profile.role);
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking auth:", error);
        toast.error("認証エラーが発生しました");
        navigate("/admin/login");
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/admin/login");
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

  // Clone children and pass userRole as a prop
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { userRole });
    }
    return child;
  });

  return <>{childrenWithProps}</>;
};