import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { BriefPage } from './routes/BriefPage';
import { CouncilPage } from './routes/CouncilPage';
import { DocumentPage } from './routes/DocumentPage';
import { EvolutionPage } from './routes/EvolutionPage';
import { HowItWorksPage } from './routes/HowItWorksPage';
import { LandingPage } from './routes/LandingPage';
import { ResearchPage } from './routes/ResearchPage';
import { RunIndexRedirect, RunLayout } from './routes/RunLayout';
import { RunLibraryPage } from './routes/RunLibraryPage';
import { SeatPage } from './routes/SeatPage';

function runChildren() {
  return (
    <>
      <Route index element={<RunIndexRedirect />} />
      <Route path="brief" element={<BriefPage />} />
      <Route path="council" element={<CouncilPage />} />
      <Route path="council/:seat" element={<SeatPage />} />
      <Route path="document" element={<DocumentPage />} />
      <Route path="evolution" element={<EvolutionPage />} />
      <Route path="research" element={<ResearchPage />} />
    </>
  );
}

function NotFound() {
  return (
    <div className="page page--narrow">
      <h1 className="page__title">Nothing here</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        That page does not exist.
      </p>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/runs" element={<RunLibraryPage />} />
          <Route path="/404" element={<NotFound />} />
        </Route>
        <Route path="/runs/:runId" element={<RunLayout kind="live" />}>
          {runChildren()}
        </Route>
        <Route path="/s/:token" element={<RunLayout kind="share" />}>
          {runChildren()}
        </Route>
        <Route path="/demo" element={<RunLayout kind="demo" />}>
          {runChildren()}
        </Route>
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </ToastProvider>
  );
}
