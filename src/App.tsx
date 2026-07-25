import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './ui/routes/DashboardPage';
import { PlanPage } from './ui/routes/PlanPage';
import { StudyPage } from './ui/routes/StudyPage';
import { SessionBar } from './ui/components/SessionBar';
import { StaleSessionBanner } from './ui/components/StaleSessionBanner';

export function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/plan">Plan</NavLink>
          <NavLink to="/study">Study</NavLink>
        </nav>
        <SessionBar />
      </header>
      <StaleSessionBanner />
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/study" element={<StudyPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
