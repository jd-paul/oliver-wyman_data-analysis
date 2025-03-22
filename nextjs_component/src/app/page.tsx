'use client';

import { useState } from 'react';
import EmissionsAnalysis from './components/EmissionsAnalysis';
import BestSellersAnalysis from './components/BestSellersAnalysis';
import PromotionsComparison from './components/PromotionsComparison';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
          July 2024 Promotional Campaign Analysis
        </h1>
        <PromotionsComparison />
      </div>
    </main>
  );
}
