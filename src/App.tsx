import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CheckIn from "./pages/CheckIn";
import Receipt from "./pages/Receipt";
import Status from "./pages/Status";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Collection from "./pages/Collection";
import ResetPassword from "./pages/ResetPassword";
import AdminDemoLogin from "./pages/AdminDemoLogin";
import AdminDemoDashboard from "./pages/AdminDemoDashboard";
import Workspaces from "./pages/Workspaces";
import WorkspaceDetail from "./pages/WorkspaceDetail";
import WorkspaceAdmins from "./pages/WorkspaceAdmins";
import LobbyManage from "./pages/LobbyManage";
import JoinLobby from "./pages/JoinLobby";
import { AdminGuard } from "./components/AdminGuard";
import { WorkspaceAuthGate } from "./components/workspace/WorkspaceAuthGate";
import { RecoveryWatcher } from "./components/RecoveryWatcher";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RecoveryWatcher />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/receipt/:id" element={<Receipt />} />
          <Route path="/status" element={<Status />} />
          <Route path="/status/:id" element={<Status />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/collection" element={<AdminGuard><Collection /></AdminGuard>} />
          <Route path="/admin-demo" element={<AdminDemoLogin />} />
          <Route path="/admin-dashboard" element={<AdminDemoDashboard />} />
          {/* Workspace / Lobby system */}
          <Route path="/workspaces" element={<WorkspaceAuthGate><Workspaces /></WorkspaceAuthGate>} />
          <Route path="/workspaces/:id" element={<WorkspaceAuthGate><WorkspaceDetail /></WorkspaceAuthGate>} />
          <Route path="/workspaces/:wsId/admins" element={<WorkspaceAuthGate><WorkspaceAdmins /></WorkspaceAuthGate>} />
          <Route path="/workspaces/:wsId/lobbies/:lobbyId" element={<WorkspaceAuthGate><LobbyManage /></WorkspaceAuthGate>} />
          <Route path="/join/:lobbyId" element={<JoinLobby />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
