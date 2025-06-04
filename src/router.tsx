
import { createBrowserRouter } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Shift from "./pages/Shift";
import ShiftLogin from "./pages/ShiftLogin";
import ShiftRequest from "./pages/ShiftRequest";
import ReservationConfirm from "./pages/ReservationConfirm";
import ReservationComplete from "./pages/ReservationComplete";
import ReservationPending from "./pages/ReservationPending";
import ReservationDetail from "./pages/ReservationDetail";
import { AdminGuard } from "./components/admin/AdminGuard";
import { ShiftGuard } from "./components/shift/ShiftGuard";
import Shift2 from "./pages/Shift2";
import Shift2Dashboard from "./pages/Shift2Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/admin",
    element: (
      <AdminGuard>
        <Admin />
      </AdminGuard>
    ),
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
  },
  {
    path: "/shift",
    element: (
      <ShiftGuard>
        <Shift />
      </ShiftGuard>
    ),
  },
  {
    path: "/shift/login",
    element: <ShiftLogin />,
  },
  {
    path: "/shift/request",
    element: (
      <ShiftGuard>
        <ShiftRequest />
      </ShiftGuard>
    ),
  },
  {
    path: "/shift2",
    element: <Shift2 />,
  },
  {
    path: "/shift2/dashboard",
    element: <Shift2Dashboard />,
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
    element: <ReservationDetail />,
  },
]);
