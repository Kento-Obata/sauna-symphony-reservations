import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import { ReservationDetail } from "@/pages/ReservationDetail";
import ReservationPending from "@/pages/ReservationPending";
import ReservationConfirm from "@/pages/ReservationConfirm";
import ReservationComplete from "@/pages/ReservationComplete";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/reservation/:code" element={<ReservationDetail />} />
        <Route path="/reservation/pending" element={<ReservationPending />} />
        <Route path="/reservation/confirm/:token" element={<ReservationConfirm />} />
        <Route path="/reservation/complete" element={<ReservationComplete />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;