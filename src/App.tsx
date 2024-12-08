import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import { PaymentCallback } from "./components/PaymentCallback";
import ReservationComplete from "./pages/ReservationComplete";
import ReservationDetail from "./pages/ReservationDetail";
import { Toaster } from "./components/ui/sonner";
import Access from "./pages/Access";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Access />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/reservation/complete" element={<ReservationComplete />} />
          <Route path="/reservation/:reservationCode" element={<ReservationDetail />} />
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;