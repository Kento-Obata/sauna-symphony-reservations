import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HerbPrepList } from "./HerbPrepList";
import { HerbMasterManager } from "./HerbMasterManager";

export const HerbManagement = () => (
  <Tabs defaultValue="prep" className="w-full">
    <TabsList>
      <TabsTrigger value="prep">仕込みリスト</TabsTrigger>
      <TabsTrigger value="master">ブレンド・ハーブ設定</TabsTrigger>
    </TabsList>
    <TabsContent value="prep" className="space-y-6">
      <HerbPrepList />
    </TabsContent>
    <TabsContent value="master" className="space-y-6">
      <HerbMasterManager />
    </TabsContent>
  </Tabs>
);
