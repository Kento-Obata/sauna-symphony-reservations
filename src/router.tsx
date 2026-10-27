
import { createBrowserRouter } from "react-router-dom";
import { lazy as reactLazy, Suspense, type ComponentType, type ReactNode } from "react";
import ReservationConfirm from "./pages/ReservationConfirm";
import ReservationComplete from "./pages/ReservationComplete";
import ReservationPending from "./pages/ReservationPending";
import Index from "./pages/Index";
import { AdminGuard } from "./components/admin/AdminGuard";
import { ShiftGuard } from "./components/shift/ShiftGuard";

// デプロイで古いチャンクが消えて読み込みに失敗したら、1回だけページを再読み込みする
const RELOAD_KEY = "u-chunk-reload";
const lazy = <T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) =>
  reactLazy(() =>
    factory()
      .then((m) => {
        sessionStorage.removeItem(RELOAD_KEY);
        return m;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      })
  );

// トップと予約直後の画面以外(管理画面・シフト・各種詳細)は遅延読み込みにして、予約ページの初回表示を軽くする
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Shift = lazy(() => import("./pages/Shift"));
const ShiftLogin = lazy(() => import("./pages/ShiftLogin"));
const ShiftRequest = lazy(() => import("./pages/ShiftRequest"));
const Shift2 = lazy(() => import("./pages/Shift2"));
const Shift2Dashboard = lazy(() => import("./pages/Shift2Dashboard"));
const ReservationDetail = lazy(() => import("./pages/ReservationDetail"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Kodawari = lazy(() => import("./pages/Kodawari"));
const EventList = lazy(() => import("./pages/EventList"));
const EventPage = lazy(() => import("./pages/EventPage"));
const EventReservationComplete = lazy(() => import("./pages/EventReservationComplete"));
const EventReservationDetail = lazy(() => import("./pages/EventReservationDetail"));

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-u-mist" aria-busy="true">
    <span className="h-6 w-6 animate-spin rounded-full border border-black/20 border-t-black/70" />
  </div>
);

const withSuspense = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/kodawari",
    element: withSuspense(<Kodawari />),
  },
  {
    path: "/admin",
    element: withSuspense((
      <AdminGuard>
        <Admin />
      </AdminGuard>
    )),
  },
  {
    path: "/admin/login",
    element: withSuspense(<AdminLogin />),
  },
  {
    path: "/shift",
    element: withSuspense((
      <ShiftGuard>
        <Shift />
      </ShiftGuard>
    )),
  },
  {
    path: "/shift/login",
    element: withSuspense(<ShiftLogin />),
  },
  {
    path: "/shift/request",
    element: withSuspense((
      <ShiftGuard>
        <ShiftRequest />
      </ShiftGuard>
    )),
  },
  {
    path: "/shift2",
    element: withSuspense(<Shift2 />),
  },
  {
    path: "/shift2/dashboard",
    element: withSuspense((
      <ShiftGuard>
        <Shift2Dashboard />
      </ShiftGuard>
    )),
  },
  {
    path: "/reservation/confirm/:token",
    element: <ReservationConfirm />,
  },
  {
    path: "/reservation/complete",
    element: <ReservationComplete />,
  },
  {
    path: "/reservation/pending",
    element: <ReservationPending />,
  },
  {
    path: "/reservation/:code",
    element: withSuspense(<ReservationDetail />),
  },
  {
    path: "/unsubscribe",
    element: withSuspense(<Unsubscribe />),
  },
  {
    path: "/events",
    element: withSuspense(<EventList />),
  },
  {
    // 静的セグメントが :slug より優先される。complete / reservation は
    // events.slug の予約語（DB CHECK 制約で使用不可）
    path: "/events/complete",
    element: withSuspense(<EventReservationComplete />),
  },
  {
    path: "/events/reservation/:code",
    element: withSuspense(<EventReservationDetail />),
  },
  {
    path: "/events/:slug",
    element: withSuspense(<EventPage />),
  },
]);
