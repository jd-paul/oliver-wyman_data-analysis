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

interface ProcessedProduct {
  productKey: string;
  originalPrice: number;
  newPrice: number;
  originalVolume: number;
  newVolume: number;
  originalSales: number;
  newSales: number;
  salesUplift: number;
  marginPercent: number;
  originalGrossProfit: number;
  newGrossProfit: number;
  originalProfit: number;
  newProfit: number;
  profitUplift: number;
  originalEmissions: number;
  newEmissions: number;
  originalOffsetCost: number;
  newOffsetCost: number;
  offsetCostChange: number;
  totalEmissionsPerUnit: number;
}

interface Summary {
  originalTotalSales: number;
  newTotalSales: number;
  totalSalesUplift: number;
  originalTotalProfit: number;
  newTotalProfit: number;
  totalProfitUplift: number;
  originalTotalEmissions: number;
  newTotalEmissions: number;
  totalEmissionsChange: number;
  originalTotalOffsetCost: number;
  newTotalOffsetCost: number;
  totalOffsetCostChange: number;
}

interface OptimalAnalysis {
  optimalDiscount: number;
  bonusTriggered: boolean;
  previousProfit: number;
  newProfitWithBonus: number;
  profitPercentageIncrease: number;
  previousRevenue: number;
  newRevenue: number;
  revenuePercentageIncrease: number;
  previousEmissions: number;
  newEmissions: number;
  emissionsPercentageIncrease: number;
  emissionsPerProfitBefore: number;
  emissionsPerProfitAfter: number;
}

interface APIResponse {
  products: ProcessedProduct[];
  summary: Summary;
}

const formatNumber = (value: number): string => {
  return value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SupplierAnalysis() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimalAnalysis, setOptimalAnalysis] = useState<OptimalAnalysis | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analysisResponse, optimalResponse] = await Promise.all([
        fetch('/api/supplier-analysis'),
        fetch('/api/supplier-analysis/optimal')
      ]);

      if (!analysisResponse.ok || !optimalResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [analysisData, optimalData] = await Promise.all([
        analysisResponse.json(),
        optimalResponse.json()
      ]);

      setData(analysisData);
      setOptimalAnalysis(optimalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const salesChartData: ChartData<'bar'> = {
    labels: data?.products.map(p => `Product ${p.productKey}`) || [],
    datasets: [
      {
        label: 'Original Sales (RM)',
        data: data?.products.map(p => p.originalSales) || [],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
      {
        label: 'New Sales with 15% Discount (RM)',
        data: data?.products.map(p => p.newSales) || [],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1,
      }
    ],
  };

  const emissionsChartData: ChartData<'bar'> = {
    labels: data?.products.map(p => `Product ${p.productKey}`) || [],
    datasets: [
      {
        label: 'Original Emissions (kg CO2)',
        data: data?.products.map(p => p.originalEmissions) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
      {
        label: 'New Emissions (kg CO2)',
        data: data?.products.map(p => p.newEmissions) || [],
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        borderColor: 'rgb(255, 159, 64)',
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
        text: 'Sales Impact of 15% Discount on Supplier Products',
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
        <h1 className="text-2xl font-bold">Supplier Analysis - ID: 1098896101</h1>
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
      ) : data?.products.length === 0 ? (
        <div className="text-center text-gray-600">No data available</div>
      ) : (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">July 2024 Supplier Support Analysis</h2>
          <p className="text-gray-600 mb-4">
            Analysis of July sales data with 15% discount applied to all products from Supplier 1098896101
          </p>
          
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Original Sales Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Before 15% Discount (July)</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">RM {data?.summary.originalTotalSales.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold">RM {data?.summary.originalTotalProfit.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
              </div>
            </div>

            {/* New Sales Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">After 15% Discount (July)</h3>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">RM {data?.summary.newTotalSales.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {data?.summary.totalSalesUplift.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600">({((data?.summary.totalSalesUplift ?? 0) / (data?.summary.originalTotalSales ?? 1) * 100).toFixed(1)}% change)</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold">RM {data?.summary.newTotalProfit.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {data?.summary.totalProfitUplift.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600">({((data?.summary.totalProfitUplift ?? 0) / (data?.summary.originalTotalProfit ?? 1) * 100).toFixed(1)}% change)</p>
                </div>
              </div>
            </div>

            {/* Original Environmental Impact Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Environmental Impact Before (July)</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Emissions</p>
                  <p className="text-2xl font-bold">{data?.summary.originalTotalEmissions.toFixed(2)} kg CO2</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Offset Cost</p>
                  <p className="text-2xl font-bold">RM {data?.summary.originalTotalOffsetCost.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
              </div>
            </div>

            {/* New Environmental Impact Box */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Environmental Impact After (July)</h3>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Emissions</p>
                  <p className="text-2xl font-bold">{data?.summary.newTotalEmissions.toFixed(2)} kg CO2</p>
                  <p className="text-sm text-gray-600 mt-1">Change: {data?.summary.totalEmissionsChange.toFixed(2)} kg CO2</p>
                  <p className="text-sm text-gray-600">({((data?.summary.totalEmissionsChange ?? 0) / (data?.summary.originalTotalEmissions ?? 1) * 100).toFixed(1)}% change)</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Offset Cost</p>
                  <p className="text-2xl font-bold">RM {data?.summary.newTotalOffsetCost.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600 mt-1">Change: RM {data?.summary.totalOffsetCostChange.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                  <p className="text-sm text-gray-600">({((data?.summary.totalOffsetCostChange ?? 0) / (data?.summary.originalTotalOffsetCost ?? 1) * 100).toFixed(1)}% change)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="mb-4">
              <p className="text-gray-600">Showing July 2024 sales impact for all products from Supplier 1098896101</p>
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

          {/* Product details table */}
          <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
            <h3 className="text-lg font-semibold mb-3">Product Details</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Original Price (RM)</th>
                    <th className="px-4 py-2 text-right">New Price (RM)</th>
                    <th className="px-4 py-2 text-right">Original Volume</th>
                    <th className="px-4 py-2 text-right">New Volume</th>
                    <th className="px-4 py-2 text-right">Original Sales (RM)</th>
                    <th className="px-4 py-2 text-right">New Sales (RM)</th>
                    <th className="px-4 py-2 text-right">Sales Uplift (RM)</th>
                    <th className="px-4 py-2 text-right">Margin (%)</th>
                    <th className="px-4 py-2 text-right">Original Profit (RM)</th>
                    <th className="px-4 py-2 text-right">New Profit (RM)</th>
                    <th className="px-4 py-2 text-right">Profit Uplift (RM)</th>
                    <th className="px-4 py-2 text-right">Original Emissions (kg CO2)</th>
                    <th className="px-4 py-2 text-right">New Emissions (kg CO2)</th>
                    <th className="px-4 py-2 text-right">Offset Cost Change (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.products.map((product) => (
                    <tr key={product.productKey} className="border-b">
                      <td className="px-4 py-2">Product {product.productKey}</td>
                      <td className="px-4 py-2 text-right">{product.originalPrice.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.newPrice.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.originalVolume.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{product.newVolume.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{product.originalSales.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.newSales.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.salesUplift.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{(product.marginPercent * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right">{product.originalProfit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.newProfit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.profitUplift.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right">{product.originalEmissions.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{product.newEmissions.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{product.offsetCostChange.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {optimalAnalysis && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Optimal Discount Analysis Using Golden Section Search</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Optimal Discount Rate</h3>
              <p className="text-2xl font-bold text-blue-600">
                {(optimalAnalysis.optimalDiscount * 100).toFixed(1)}%
              </p>
              {optimalAnalysis.bonusTriggered && (
                <p className="text-sm text-green-600 mt-2">
                  Bonus Threshold Achieved! (+RM 50,000)
                </p>
              )}
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Profit Impact</h3>
              <p className="text-2xl font-bold text-green-600">
                +RM {formatNumber(optimalAnalysis.newProfitWithBonus - optimalAnalysis.previousProfit)}
              </p>
              <p className="text-sm text-gray-600">
                {optimalAnalysis.profitPercentageIncrease.toFixed(1)}% increase
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Revenue Impact</h3>
              <p className="text-2xl font-bold text-purple-600">
                +RM {formatNumber(optimalAnalysis.newRevenue - optimalAnalysis.previousRevenue)}
              </p>
              <p className="text-sm text-gray-600">
                {optimalAnalysis.revenuePercentageIncrease.toFixed(1)}% increase
              </p>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Environmental Impact</h3>
              <p className="text-2xl font-bold text-amber-600">
                {optimalAnalysis.emissionsPercentageIncrease > 0 ? '+' : ''}
                {optimalAnalysis.emissionsPercentageIncrease.toFixed(1)}% CO2
              </p>
              <p className="text-sm text-gray-600">
                {formatNumber(optimalAnalysis.newEmissions - optimalAnalysis.previousEmissions)} kg CO2 change
              </p>
            </div>

            <div className="bg-teal-50 p-4 rounded-lg col-span-2">
              <h3 className="font-semibold mb-2">Emissions Efficiency</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Before</p>
                  <p className="text-xl font-bold text-teal-600">
                    {optimalAnalysis.emissionsPerProfitBefore.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">kg CO2/RM profit</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">After</p>
                  <p className="text-xl font-bold text-teal-600">
                    {optimalAnalysis.emissionsPerProfitAfter.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">kg CO2/RM profit</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
