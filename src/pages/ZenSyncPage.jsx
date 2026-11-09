import React from 'react';
import ZenSyncApp from '../../Zensync/src/App';
import '../../Zensync/src/index.css';
import { useAuth } from '../context/AuthContext';

export default function ZenSyncPage() {
  const { isAdmin, login } = useAuth();

  return (
    <div className="w-full min-h-[100dvh] overflow-hidden zensync-scope" style={{ backgroundColor: '#000000' }}>
      <ZenSyncApp isAdmin={isAdmin} onLogin={login} />
    </div>
  );
}
