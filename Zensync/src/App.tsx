import { useState, useEffect } from 'react';
import type { UserRole, DeviceAuditInfo } from './types';
import { HomeScreen } from './components/HomeScreen';
import { MainMode } from './components/MainMode';
import { SubMode } from './components/SubMode';
import { HelperMode } from './components/HelperMode';
import { MusicianMode } from './components/MusicianMode';
import { generateSessionCode } from './lib/presentationUtils';

interface AppProps {
  isAdmin?: boolean;
  onLogin?: (email: string, pass: string) => Promise<any>;
}

export function App({ isAdmin = false, onLogin }: AppProps) {
  const [role, setRole] = useState<UserRole>('home');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceAuditInfo | undefined>(undefined);
  const [createdAdminPassword, setCreatedAdminPassword] = useState<string | undefined>(undefined);

  // Sync state with browser URL search params and respond to browser Back/Forward (popstate)
  useEffect(() => {
    const syncStateFromUrl = () => {
      const search = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const params = new URLSearchParams(search);
      const paramRole = params.get('role') as UserRole | null;
      const paramCode = params.get('code');

      if (paramRole && ['main', 'sub', 'helper', 'musician'].includes(paramRole) && paramCode) {
        setRole(paramRole);
        setSessionCode(paramCode);
      } else {
        setRole('home');
        setSessionCode('');
      }
    };

    syncStateFromUrl();
    window.addEventListener('popstate', syncStateFromUrl);
    return () => {
      window.removeEventListener('popstate', syncStateFromUrl);
    };
  }, []);

  const getBasePath = () => {
    return window.location.pathname.includes('sync') ? window.location.pathname : '/zensync';
  };

  const handleSelectRole = (newRole: UserRole, code?: string, devInfo?: DeviceAuditInfo, adminPassword?: string) => {
    const basePath = getBasePath();
    if (newRole === 'main') {
      const newCode = code || generateSessionCode();
      setSessionCode(newCode);
      setDeviceInfo(devInfo);
      setCreatedAdminPassword(adminPassword);
      if (adminPassword) {
        sessionStorage.setItem(`zensync_create_pw_${newCode}`, adminPassword);
      }
      setRole('main');
      window.history.pushState({}, '', `${basePath}?role=main&code=${newCode}`);
    } else if ((newRole === 'sub' || newRole === 'helper' || newRole === 'musician') && code) {
      setSessionCode(code);
      setDeviceInfo(devInfo);
      setRole(newRole);
      window.history.pushState({}, '', `${basePath}?role=${newRole}&code=${code}`);
    }
  };

  const handleExit = () => {
    if (sessionCode) {
      sessionStorage.removeItem(`zensync_create_pw_${sessionCode.toLowerCase()}`);
    }
    setRole('home');
    setSessionCode('');
    setCreatedAdminPassword(undefined);
    window.history.pushState({}, '', getBasePath());
  };

  return (
    <div className="zensync-scope">
      {role === 'home' && (
        <HomeScreen onSelectRole={handleSelectRole} isAdmin={isAdmin} onLogin={onLogin} />
      )}

      {role === 'main' && sessionCode && (
        <MainMode
          sessionCode={sessionCode}
          initialDeviceInfo={deviceInfo}
          initialAdminPassword={createdAdminPassword}
          onExit={handleExit}
        />
      )}

      {role === 'sub' && sessionCode && (
        <SubMode sessionCode={sessionCode} initialDeviceInfo={deviceInfo} onExit={handleExit} />
      )}

      {role === 'helper' && sessionCode && (
        <HelperMode sessionCode={sessionCode} initialDeviceInfo={deviceInfo} onExit={handleExit} />
      )}

      {role === 'musician' && sessionCode && (
        <MusicianMode sessionCode={sessionCode} initialDeviceInfo={deviceInfo} onExit={handleExit} />
      )}
    </div>
  );
}

export default App;

