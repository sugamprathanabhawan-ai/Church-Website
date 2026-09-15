import React from 'react';
import ZenSyncApp from '../../Zensync/src/App';
import '../../Zensync/src/index.css';

export default function ZenSyncPage() {
  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] overflow-hidden bg-white zensync-scope">
      <ZenSyncApp />
    </div>
  );
}
