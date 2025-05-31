
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftRequestForm } from "@/components/shift2/ShiftRequestForm";
import { ShiftRequestList } from "@/components/shift2/ShiftRequestList";
import { ApprovedShiftsList } from "@/components/shift2/ApprovedShiftsList";
import { AdminShiftManagement } from "@/components/shift2/AdminShiftManagement";

const Shift2Dashboard = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 実際の認証チェックは後で実装
    // 今は仮のユーザー情報を設定
    setCurrentUser({ id: "test", username: "テストユーザー" });
    setIsAdmin(true); // デモ用
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    navigate("/shift2");
  };

  if (!currentUser) {
    return <div>認証中...</div>;
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
