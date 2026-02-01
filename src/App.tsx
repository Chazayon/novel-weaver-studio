import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectPicker from "./pages/ProjectPicker";
import WorkflowCockpit from "./pages/WorkflowCockpit";
import ChapterStudio from "./pages/ChapterStudio";
import PhaseEditor from "./pages/PhaseEditor";
import CompileExport from "./pages/CompileExport";
import LLMSettings from "./pages/LLMSettings";
import DraftingWizard from "./pages/DraftingWizard";
import Phase5ContextBundleWizard from "./pages/Phase5ContextBundleWizard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectPicker />} />
          <Route path="/cockpit" element={<WorkflowCockpit />} />
          <Route path="/chapter-studio" element={<ChapterStudio />} />
          <Route path="/phase-editor/:phaseId" element={<PhaseEditor />} />
          <Route path="/compile" element={<CompileExport />} />
          <Route path="/llm-settings" element={<LLMSettings />} />
          <Route path="/phase5-context" element={<Phase5ContextBundleWizard />} />
          <Route path="/phase6-wizard" element={<DraftingWizard />} />
          <Route path="/drafting-wizard" element={<DraftingWizard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
