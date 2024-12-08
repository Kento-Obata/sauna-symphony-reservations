import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import { PaymentCallback } from "./components/PaymentCallback";
import ReservationComplete from "./pages/ReservationComplete";
import { Toaster } from "./components/ui/sonner";
import Index from "./pages/Index";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/reservation/complete" element={<ReservationComplete />} />
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;