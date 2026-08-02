import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { CharacterReferencePage } from './pages/CharacterReferencePage';
import { ScriptBuilderPage } from './pages/ScriptBuilderPage';
import { RoleAssignmentPage } from './pages/RoleAssignmentPage';
import { GamePage } from './pages/GamePage';
import { NightAssistantPage } from './pages/NightAssistantPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreateRoomPage />} />
        <Route path="/join" element={<JoinRoomPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/characters" element={<CharacterReferencePage />} />
        <Route path="/script" element={<ScriptBuilderPage />} />
        <Route path="/assign" element={<RoleAssignmentPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/night" element={<NightAssistantPage />} />
      </Routes>
    </BrowserRouter>
  );
}
