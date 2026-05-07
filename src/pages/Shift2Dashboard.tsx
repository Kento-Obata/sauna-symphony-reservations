
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftRequestForm } from "@/components/shift2/ShiftRequestForm";
import { ShiftRequestList } from "@/components/shift2/ShiftRequestList";
import { ApprovedShiftsList } from "@/components/shift2/ApprovedShiftsList";
import { AdminShiftManagement } from "@/components/shift2/AdminShiftManagement";
import { supabase } from "@/integrations/supabase/client";

const Shift2Dashboard = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/shift2");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .single();
      setCurrentUser({ id: user.id, username: profile?.username || user.email || "" });
      setIsAdmin(profile?.role === "admin");
      setIsLoading(false);
    };
    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate("/shift2");
  };

  if (isLoading || !currentUser) {
    return <div className="min-h-screen flex items-center justify-center">認証中...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">シフト管理 v2</h1>
          <p className="text-gray-600">ようこそ、{currentUser.username}さん</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requests">シフト希望</TabsTrigger>
          <TabsTrigger value="my-requests">申請状況</TabsTrigger>
          <TabsTrigger value="approved">承認済み</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">管理者</TabsTrigger>}
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>シフト希望申請</CardTitle>
            </CardHeader>
            <CardContent>
              <ShiftRequestForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>申請状況</CardTitle>
            </CardHeader>
            <CardContent>
              <ShiftRequestList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>承認済みシフト</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovedShiftsList />
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <AdminShiftManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Shift2Dashboard;
