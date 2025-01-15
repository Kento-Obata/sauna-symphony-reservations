import { createBrowserRouter } from "react-router-dom";
import Index from "@/pages/Index";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import { ReservationDetail } from "@/pages/ReservationDetail";
import ReservationPending from "@/pages/ReservationPending";
import ReservationConfirm from "@/pages/ReservationConfirm";
import ReservationComplete from "@/pages/ReservationComplete";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/admin",
    element: <Admin />,
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
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