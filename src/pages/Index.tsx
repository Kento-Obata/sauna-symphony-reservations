import Header from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="absolute top-4 right-4 z-50">
        <Button onClick={handleLogout} variant="destructive">
          ログアウト
        </Button>
      </div>
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-20">
        <ReservationForm />
      </section>
    </div>
  );
};

export default Index;