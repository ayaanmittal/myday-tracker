import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { FirstTimeRulesDialog } from "./components/FirstTimeRulesDialog";
import { UpdatedRulesDialog } from "./components/UpdatedRulesDialog";

const queryClient = new QueryClient();

import { AuthProvider } from "./hooks/useAuth";
import Login from "./pages/Login";
import Today from "./pages/Today";
import History from "./pages/History";
import HistoryV2 from "./pages/HistoryV2";
import HistoryWithFetch from "./pages/HistoryWithFetch";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import AdminReports from "./pages/AdminReports";
import Messages from "./pages/Messages";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import ManageEmployees from "./pages/ManageEmployees";
import OfficeRules from "./pages/OfficeRules";
import ManageRules from "./pages/ManageRules";
import AdminTools from "./pages/AdminTools";
import TaskManager from "./pages/TaskManager";
import Tasks from "./pages/Tasks";
import LeaveApplication from "./pages/LeaveApplication";
import LeaveApproval from "./pages/LeaveApproval";
import { ServerStatus } from "./pages/ServerStatus";
import { BiometricTest } from "./pages/BiometricTest";
import Announcements from "./pages/Announcements";
import Notifications from "./pages/Notifications";
import Meetings from "./pages/Meetings";
import Violations from "./pages/Violations";
import WorkDaysSettings from "./pages/WorkDaysSettings";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FirstTimeRulesDialog />
          <UpdatedRulesDialog />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/today" element={<Today />} />
            <Route path="/history" element={<History />} />
            <Route path="/history-v2" element={<HistoryV2 />} />
            <Route path="/history-fetch" element={<HistoryWithFetch />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin-reports" element={<AdminReports />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/manage-employees" element={<ManageEmployees />} />
            <Route path="/task-manager" element={<TaskManager />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/leave" element={<LeaveApplication />} />
            <Route path="/leave-approval" element={<LeaveApproval />} />
            <Route path="/server-status" element={<ServerStatus />} />
            <Route path="/biometric-test" element={<BiometricTest />} />
            <Route path="/office-rules" element={<OfficeRules />} />
            <Route path="/manage-rules" element={<ManageRules />} />
            <Route path="/admin-tools" element={<AdminTools />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/violations" element={<Violations />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/work-days-settings" element={<WorkDaysSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
