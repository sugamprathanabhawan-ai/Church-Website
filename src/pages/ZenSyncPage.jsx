import React from 'react';
import ZenSyncApp from '../../Zensync/src/App';
import '../../Zensync/src/index.css';
import { useAuth } from '../context/AuthContext';

export default function ZenSyncPage() {
  const { isAdmin, login } = useAuth();

  return (
    <div 
      className="w-full min-h-[100dvh] overflow-x-hidden zensync-scope"
      style={{
        background: 'radial-gradient(at 0% 0%, rgba(224, 242, 254, 0.45) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(240, 249, 255, 0.6) 0px, transparent 50%), #f8fafc'
      }}
    >
      <ZenSyncApp isAdmin={isAdmin} onLogin={login} />
    </div>
  );
}
