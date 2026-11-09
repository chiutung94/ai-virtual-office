import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Office from './pages/Office';
import Episodes from './pages/Episodes';
import EpisodeDetail from './pages/EpisodeDetail';
import ScriptStudio from './pages/ScriptStudio';
import Storyboard from './pages/Storyboard';
import Characters from './pages/Characters';
import Locations from './pages/Locations';
import Departments from './pages/Departments';
import VideoProduction from './pages/VideoProduction';
import KlingPack from './pages/KlingPack';
import Voice from './pages/Voice';
import Editing from './pages/Editing';
import Approvals from './pages/Approvals';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import Budget from './pages/Budget';
import Settings from './pages/Settings';
import SetupGuide from './pages/SetupGuide';
import { Empty } from './components/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="office" element={<Office />} />
          <Route path="projects" element={<Projects />} />
          <Route path="episodes" element={<Episodes />} />
          <Route path="episodes/:id" element={<EpisodeDetail />} />
          <Route path="script" element={<ScriptStudio />} />
          <Route path="script/:id" element={<ScriptStudio />} />
          <Route path="storyboard" element={<Storyboard />} />
          <Route path="characters" element={<Characters />} />
          <Route path="locations" element={<Locations />} />
          <Route path="departments" element={<Departments />} />
          <Route path="video" element={<VideoProduction />} />
          <Route path="video/kling" element={<KlingPack />} />
          <Route path="voice" element={<Voice />} />
          <Route path="editing" element={<Editing />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="budget" element={<Budget />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/setup" element={<SetupGuide />} />
          <Route path="*" element={<Empty title="Page not found">Use the navigation to continue.</Empty>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
