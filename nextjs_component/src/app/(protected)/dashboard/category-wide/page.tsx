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
  ChartData,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AnalysisData {
  baseline: {
    totalSales: number;
    totalProfit: number;
    totalEmissions: number;
    totalOffsetCost: number;
  };
  new: {
    totalSales: number;
    totalProfit: number;
    totalEmissions: number;
    totalOffsetCost: number;
  };
  incremental: {
    sales: number;
    profit: number;
    emissions: number;
    offsetCost: number;
  };
  ratios: {
    sales: number;
    profit: number;
    emissions: number;
    offsetCost: number;
  };
  discountRate: number;
}

const formatNumber = (value: number): string => {
  return value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CategoryWideAnalysis() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/category-wide');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const analysisData = await response.json();
      setData(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const salesChartData: ChartData<'bar'> = {
    labels: ['Baseline', 'With 5% Discount'],
    datasets: [
      {
        label: 'Total Sales (RM)',
        data: data ? [data.baseline.totalSales, data.new.totalSales] : [],
        backgroundColor: ['rgba(75, 192, 192, 0.5)', 'rgba(255, 99, 132, 0.5)'],
        borderColor: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)'],
        borderWidth: 1,
      }
    ],
  };

  const emissionsChartData: ChartData<'bar'> = {
    labels: ['Baseline', 'With 5% Discount'],
    datasets: [
      {
        label: 'Total Emissions (kg CO2)',
        data: data ? [data.baseline.totalEmissions, data.new.totalEmissions] : [],
        backgroundColor: ['rgba(54, 162, 235, 0.5)', 'rgba(255, 159, 64, 0.5)'],
        borderColor: ['rgb(54, 162, 235)', 'rgb(255, 159, 64)'],
        borderWidth: 1,
      }
    ],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Sales Impact of 5% Discount on All Products',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Sales (RM)',
        },
      },
    },
  };

  const emissionsChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Emissions Impact of Sales Volume Increase',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Emissions (kg CO2)',
        },
      },
    },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Category-Wide Analysis</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="text-center text-gray-600">No data available</div>
      ) : (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">July 2024 Category-Wide Analysis</h2>
          <p className="text-gray-600 mb-4">
            Analysis of July sales data with 5% discount applied to all products
          </p>
          
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Original Sales Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Before 5% Discount (July)</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.baseline.totalSales)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.baseline.totalProfit)}</p>
                </div>
              </div>
            </div>

            {/* New Sales Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">After 5% Discount (July)</h3>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.new.totalSales)}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {formatNumber(data.incremental.sales)}</p>
                  <p className="text-sm text-gray-600">({(data.ratios.sales * 100).toFixed(2)}% change)</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.new.totalProfit)}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {formatNumber(data.incremental.profit)}</p>
                  <p className="text-sm text-gray-600">({(data.ratios.profit * 100).toFixed(2)}% change)</p>
                </div>
              </div>
            </div>

            {/* Original Environmental Impact Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Environmental Impact Before (July)</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Emissions</p>
                  <p className="text-2xl font-bold">{data.baseline.totalEmissions.toFixed(2)} kg CO2</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Offset Cost</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.baseline.totalOffsetCost)}</p>
                </div>
              </div>
            </div>

            {/* New Environmental Impact Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Environmental Impact After (July)</h3>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Emissions</p>
                  <p className="text-2xl font-bold">{data.new.totalEmissions.toFixed(2)} kg CO2</p>
                  <p className="text-sm text-gray-600 mt-1">Change: {data.incremental.emissions.toFixed(2)} kg CO2</p>
                  <p className="text-sm text-gray-600">({(data.ratios.emissions * 100).toFixed(2)}% change)</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Offset Cost</p>
                  <p className="text-2xl font-bold">RM {formatNumber(data.new.totalOffsetCost)}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {formatNumber(data.incremental.offsetCost)}</p>
                  <p className="text-sm text-gray-600">({(data.ratios.offsetCost * 100).toFixed(2)}% change)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="mb-4">
              <p className="text-gray-600">Showing July 2024 sales and emissions impact for all products</p>
            </div>
            <div className="h-[400px]">
              <Bar options={chartOptions} data={salesChartData} />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Emissions Impact</h3>
              <div className="h-[400px]">
                <Bar options={emissionsChartOptions} data={emissionsChartData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
