import { useState, useEffect } from 'react';
import type { UserRole } from './types';
import { HomeScreen } from './components/HomeScreen';
import { MainMode } from './components/MainMode';
import { SubMode } from './components/SubMode';
import { HelperMode } from './components/HelperMode';
import { generateSessionCode } from './lib/presentationUtils';

export function App() {
  const [role, setRole] = useState<UserRole>('home');
  const [sessionCode, setSessionCode] = useState<string>('');

  // Sync initial state from URL query params (e.g. ?role=sub&code=4827)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramRole = params.get('role') as UserRole | null;
    const paramCode = params.get('code');

    if (paramRole && ['main', 'sub', 'helper'].includes(paramRole) && paramCode) {
      setRole(paramRole);
      setSessionCode(paramCode);
    }
  }, []);

  const handleSelectRole = (newRole: UserRole, code?: string) => {
    if (newRole === 'main') {
      const newCode = generateSessionCode();
      setSessionCode(newCode);
      setRole('main');
      window.history.pushState({}, '', `?role=main&code=${newCode}`);
    } else if ((newRole === 'sub' || newRole === 'helper') && code) {
      setSessionCode(code);
      setRole(newRole);
      window.history.pushState({}, '', `?role=${newRole}&code=${code}`);
    }
  };

  const handleExit = () => {
    setRole('home');
    setSessionCode('');
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <>
      {role === 'home' && (
        <HomeScreen onSelectRole={handleSelectRole} />
      )}

      {role === 'main' && sessionCode && (
        <MainMode sessionCode={sessionCode} onExit={handleExit} />
      )}

      {role === 'sub' && sessionCode && (
        <SubMode sessionCode={sessionCode} onExit={handleExit} />
      )}

      {role === 'helper' && sessionCode && (
        <HelperMode sessionCode={sessionCode} onExit={handleExit} />
      )}
    </>
  );
}

export default App;
