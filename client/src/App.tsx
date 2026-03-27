import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import PublicRoute from "./components/PublicRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import GameRoom from "./pages/GameRoom";
import Puzzle from "./pages/Puzzle";
import Play from "./pages/Play";
import Friends from "./pages/Friends";
import Admin from "./pages/Admin";
import ConnectBoard from "./pages/ConnectBoard";
import Courses from "./pages/Courses";
import AIGame from "./pages/AIGame";
import AILoading from "./pages/AILoading";
import Settings from "./pages/Settings";
import MyStatistics from "./pages/MyStatistics";
import GameReplay from "./pages/GameReplay";
import NotFound from "./pages/NotFound";
import ActiveGameSticky from "./components/ActiveGameSticky";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ActiveGameSticky />
          <Routes>
            {/* Public Routes (no authentication required) */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            
            {/* Protected Routes (authentication required) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/game" element={<ProtectedRoute><GameRoom /></ProtectedRoute>} />
            <Route path="/puzzle" element={<ProtectedRoute><Puzzle /></ProtectedRoute>} />
            <Route path="/play" element={<ProtectedRoute><Play /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/connect-board" element={<ProtectedRoute><ConnectBoard /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/ai-loading" element={<ProtectedRoute><AILoading /></ProtectedRoute>} />
            <Route path="/ai-game" element={<ProtectedRoute><AIGame /></ProtectedRoute>} />
            <Route path="/my-profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/my-statistics" element={<ProtectedRoute><MyStatistics /></ProtectedRoute>} />
            <Route path="/game-replay/:gameId" element={<ProtectedRoute><GameReplay /></ProtectedRoute>} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;


