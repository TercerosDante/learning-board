import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './ui/routes/DashboardPage';
import { PlanPage } from './ui/routes/PlanPage';
import { StudyPage } from './ui/routes/StudyPage';
import { ReviewPage } from './ui/routes/ReviewPage';
import { SessionBar } from './ui/components/SessionBar';
import { StaleSessionBanner } from './ui/components/StaleSessionBanner';
import { QuickCapture } from './ui/components/QuickCapture';

export function App() {
  return (
    <BrowserRouter>
      <header className="flex items-center gap-6 border-b px-4 py-2">
        <nav className="flex gap-4">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Dashboard</NavLink>
          <NavLink to="/plan" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Plan</NavLink>
          <NavLink to="/study" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Study</NavLink>
          <NavLink to="/review" className={({ isActive }) => (isActive ? 'font-bold' : '')}>Review</NavLink>
        </nav>
        <QuickCapture />
        <SessionBar />
      </header>
      <StaleSessionBanner />
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/review" element={<ReviewPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
