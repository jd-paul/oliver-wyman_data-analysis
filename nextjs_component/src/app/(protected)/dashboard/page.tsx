'use client';

import React from 'react';
import type { Session } from '@supabase/supabase-js';

interface DashboardPageProps {
  session?: Session;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ session }) => {
  return (
    <div>
      <h1>You are authenticated</h1>
      <pre className="text-sm text-gray-600">
        {JSON.stringify(session, null, 2)}
      </pre>
    </div>
  );
};

export default DashboardPage;
