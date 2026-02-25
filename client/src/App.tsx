import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTrackVisit } from "@/hooks/useTrackVisit";
import DirectoryPage from "@/pages/DirectoryPage";
import CommunityDetailPage from "@/pages/CommunityDetailPage";
import AboutPage from "@/pages/AboutPage";
import DirectoryManagerPage from "@/pages/DirectoryManagerPage";
import NotFound from "@/pages/not-found";

function Router() {
  useTrackVisit();
  return (
    <Switch>
      <Route path="/" component={DirectoryPage} />
      <Route path="/community/:slug" component={CommunityDetailPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/directory-manager" component={DirectoryManagerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Header />
        <Toaster />
        <Router />
        <Footer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
