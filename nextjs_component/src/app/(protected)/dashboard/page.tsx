'use client';

import React from 'react';
import type { Session } from '@supabase/supabase-js';
import EmissionsAnalysis from '../../components/EmissionsAnalysis';
interface DashboardPageProps {
  session?: Session;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ session }) => {
  return (
    <div className="space-y-6">      
      <div className="bg-white rounded-lg shadow">
        <EmissionsAnalysis />
      </div>
    </div>
  );
};

export default DashboardPage;
