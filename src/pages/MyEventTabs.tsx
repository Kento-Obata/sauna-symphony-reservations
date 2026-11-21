import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { EventTabBoard } from "@/components/eventTabs/EventTabBoard";

/** スタッフ用: イベント当日のオプション記録と会計（ログイン不要、トークンで本人を判別） */
const MyEventTabs = () => {
  const { token = "" } = useParams<{ token: string }>();
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 px-4 pb-20 pt-4 text-zinc-900">
      <Link to={`/my/${token}`} className="mb-3 inline-flex items-center text-sm text-zinc-500">
        <ChevronLeft className="h-4 w-4" />
        作業記録にもどる
      </Link>
      <EventTabBoard token={token} />
    </div>
  );
};

export default MyEventTabs;
