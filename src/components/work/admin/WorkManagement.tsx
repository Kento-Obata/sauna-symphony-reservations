import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkStatusBoard } from "./WorkStatusBoard";
import { WorkLogs } from "./WorkLogs";
import { WorkBonus } from "./WorkBonus";
import { WorkMasterManager } from "./WorkMasterManager";
import { StaffWorkLinks } from "./StaffWorkLinks";

export const WorkManagement = () => (
  <Tabs defaultValue="status" className="w-full">
    <TabsList>
      <TabsTrigger value="status">現場の状況</TabsTrigger>
      <TabsTrigger value="logs">作業ログ</TabsTrigger>
      <TabsTrigger value="bonus">ポイント・ボーナス</TabsTrigger>
      <TabsTrigger value="master">作業場・項目</TabsTrigger>
      <TabsTrigger value="links">スタッフ用リンク</TabsTrigger>
    </TabsList>
    <TabsContent value="status" className="space-y-6">
      <WorkStatusBoard />
    </TabsContent>
    <TabsContent value="logs" className="space-y-6">
      <WorkLogs />
    </TabsContent>
    <TabsContent value="bonus" className="space-y-6">
      <WorkBonus />
    </TabsContent>
    <TabsContent value="master" className="space-y-6">
      <WorkMasterManager />
    </TabsContent>
    <TabsContent value="links" className="space-y-6">
      <StaffWorkLinks />
    </TabsContent>
  </Tabs>
);
