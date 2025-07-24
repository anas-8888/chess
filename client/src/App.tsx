import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/game" element={<GameRoom />} />
          <Route path="/puzzle" element={<Puzzle />} />
          <Route path="/play" element={<Play />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/connect-board" element={<ConnectBoard />} />
          <Route path="/courses" element={<Courses />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
