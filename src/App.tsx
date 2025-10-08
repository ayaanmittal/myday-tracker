import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import { AuthProvider } from "./hooks/useAuth";
import Login from "./pages/Login";
import Today from "./pages/Today";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import AdminReports from "./pages/AdminReports";
import Messages from "./pages/Messages";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import ManageEmployees from "./pages/ManageEmployees";
import OfficeRules from "./pages/OfficeRules";
import ManageRules from "./pages/ManageRules";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/today" element={<Today />} />
            <Route path="/history" element={<History />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin-reports" element={<AdminReports />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/manage-employees" element={<ManageEmployees />} />
            <Route path="/office-rules" element={<OfficeRules />} />
            <Route path="/manage-rules" element={<ManageRules />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
