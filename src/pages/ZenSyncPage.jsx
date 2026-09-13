import React from 'react';
import ZenSyncApp from '../../Zensync/src/App';
import '../../Zensync/src/index.css';

export default function ZenSyncPage() {
  return (
    <div className="w-full min-h-screen bg-white">
      <ZenSyncApp />
    </div>
  );
}
