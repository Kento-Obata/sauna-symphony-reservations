import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import { PaymentCallback } from "./components/PaymentCallback";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;