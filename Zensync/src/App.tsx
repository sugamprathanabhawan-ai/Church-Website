import { useState, useEffect } from 'react';
import type { UserRole, DeviceAuditInfo } from './types';
import { HomeScreen } from './components/HomeScreen';
import { MainMode } from './components/MainMode';
import { SubMode } from './components/SubMode';
import { HelperMode } from './components/HelperMode';
import { generateSessionCode } from './lib/presentationUtils';

export function App() {
  const [role, setRole] = useState<UserRole>('home');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceAuditInfo | undefined>(undefined);

  // Sync initial state from URL query params (e.g. /zensync?role=sub&code=4827)
  useEffect(() => {
    const search = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const params = new URLSearchParams(search);
    const paramRole = params.get('role') as UserRole | null;
    const paramCode = params.get('code');

    if (paramRole && ['main', 'sub', 'helper'].includes(paramRole) && paramCode) {
      setRole(paramRole);
      setSessionCode(paramCode);
    }
  }, []);

  const getBasePath = () => {
    return window.location.pathname.includes('sync') ? window.location.pathname : '/zensync';
  };

  const handleSelectRole = (newRole: UserRole, code?: string, devInfo?: DeviceAuditInfo) => {
    const basePath = getBasePath();
    if (newRole === 'main') {
      const newCode = generateSessionCode();
      setSessionCode(newCode);
      setDeviceInfo(devInfo);
      setRole('main');
      window.history.pushState({}, '', `${basePath}?role=main&code=${newCode}`);
    } else if ((newRole === 'sub' || newRole === 'helper') && code) {
      setSessionCode(code);
      setRole(newRole);
      window.history.pushState({}, '', `${basePath}?role=${newRole}&code=${code}`);
    }
  };

  const handleExit = () => {
    setRole('home');
    setSessionCode('');
    window.history.pushState({}, '', getBasePath());
  };

  return (
    <div className="zensync-scope">
      {role === 'home' && (
        <HomeScreen onSelectRole={handleSelectRole} />
      )}

      {role === 'main' && sessionCode && (
        <MainMode sessionCode={sessionCode} initialDeviceInfo={deviceInfo} onExit={handleExit} />
      )}

      {role === 'sub' && sessionCode && (
        <SubMode sessionCode={sessionCode} onExit={handleExit} />
      )}

      {role === 'helper' && sessionCode && (
        <HelperMode sessionCode={sessionCode} onExit={handleExit} />
      )}
    </div>
  );
}

export default App;

