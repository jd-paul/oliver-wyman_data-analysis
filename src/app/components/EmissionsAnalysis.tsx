'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ProcessedProduct {
  productKey: string;
  baselineSales: number;
  projectedSales: number;
  volumeUplift: number;
  percentageVolumeIncrease: number;
  percentageRevenueChange: number;
  marginPercent: number;
  totalEmissions: number;
  supplierEmissions: number;
  categoryEmissions: number;
  brandEmissions: number;
}

interface APIResponse {
  products: ProcessedProduct[];
  totals: {
    companyBaselineRevenue: number;
    companyProjectedRevenue: number;
    companyRevenueChange: number;
    promotedProductsBaselineRevenue: number;
    promotedProductsProjectedRevenue: number;
    promotedProductsRevenueChange: number;
    promotedProductsShareOfRevenue: number;
  };
}

export default function RevenueAnalysis() {
  const [products, setProducts] = useState<ProcessedProduct[]>([]);
  const [totals, setTotals] = useState<APIResponse['totals'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/emissions');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data: APIResponse = await response.json();
      setProducts(data.products);
      setTotals(data.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const chartData = {
    labels: products.map(p => `Product ${p.productKey}`),
    datasets: [
      {
        label: 'Baseline Sales',
        data: products.map(p => p.baselineSales),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Projected Sales',
        data: products.map(p => p.projectedSales),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Sales Analysis - Top 10 Low-Emission Products',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-500">{error}</div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!products.length || !totals) {
    return (
      <div className="text-center py-8">
        No data available
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sales Analysis</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Company-wide Impact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Revenue Change</p>
              <p className="text-2xl font-bold">{totals.companyRevenueChange.toFixed(2)}%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Baseline Revenue</p>
              <p className="text-xl font-semibold">RM {(totals.companyBaselineRevenue / 1000000).toFixed(2)}M</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Projected Revenue</p>
              <p className="text-xl font-semibold">RM {(totals.companyProjectedRevenue / 1000000).toFixed(2)}M</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Promoted Products Impact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Share of Revenue</p>
              <p className="text-2xl font-bold">{totals.promotedProductsShareOfRevenue.toFixed(2)}%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Baseline Revenue</p>
              <p className="text-xl font-semibold">RM {(totals.promotedProductsBaselineRevenue / 1000000).toFixed(2)}M</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Projected Revenue</p>
              <p className="text-xl font-semibold">RM {(totals.promotedProductsProjectedRevenue / 1000000).toFixed(2)}M</p>
            </div>
            <div className="col-span-2 bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Revenue Change</p>
              <p className="text-2xl font-bold">{totals.promotedProductsRevenueChange.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div style={{ height: '400px' }}>
          <Bar options={chartOptions} data={chartData} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Product Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-right">Total Emissions (kg CO2)</th>
                <th className="px-4 py-2 text-right">Baseline Sales (RM)</th>
                <th className="px-4 py-2 text-right">Projected Sales (RM)</th>
                <th className="px-4 py-2 text-right">Volume Increase</th>
                <th className="px-4 py-2 text-right">Revenue Change</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.productKey} className="border-t">
                  <td className="px-4 py-2">Product {product.productKey}</td>
                  <td className="px-4 py-2 text-right">{product.totalEmissions.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{(product.baselineSales / 1000000).toFixed(2)}M</td>
                  <td className="px-4 py-2 text-right">{(product.projectedSales / 1000000).toFixed(2)}M</td>
                  <td className="px-4 py-2 text-right">{product.percentageVolumeIncrease.toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right">{product.percentageRevenueChange.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 