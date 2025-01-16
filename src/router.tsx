import { createBrowserRouter } from "react-router-dom";
import Index from "@/pages/Index";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import { ReservationDetail } from "@/pages/ReservationDetail";
import ReservationPending from "@/pages/ReservationPending";
import ReservationConfirm from "@/pages/ReservationConfirm";
import ReservationComplete from "@/pages/ReservationComplete";
import Shift from "@/pages/Shift";
import ShiftLogin from "@/pages/ShiftLogin";
import { ShiftGuard } from "@/components/shift/ShiftGuard";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
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
    path: "/shift/login",
    element: <ShiftLogin />,
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
    path: "/reservation/:code",
    element: <ReservationDetail />,
  },
  {
    path: "/reservation/pending",
    element: <ReservationPending />,
  },
  {
    path: "/reservation/confirm/:token",
    element: <ReservationConfirm />,
  },
  {
    path: "/reservation/complete",
    element: <ReservationComplete />,
  },
]);