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

interface PromotionData {
  name: string;
  salesAndCosts?: {
    baselineRevenue: number;
    newRevenue: number;
    revenuePercentageChange: number;
    baselineTotalProfit: number;
    newTotalProfit: number;
    incrementalProfit: number;
  };
  emissionsAndOffset: {
    baselineTotalEmissions: number;
    newTotalEmissions: number;
    incrementalEmissions: number;
    baselineOffsetCost: number;
    newOffsetCost: number;
    incrementalOffsetCost: number;
  };
}

export default function PromotionsComparison() {
  const [data, setData] = useState<{ emissions: PromotionData; bestSellers: PromotionData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emissionsResponse, bestSellersResponse] = await Promise.all([
        fetch('/api/emissions-analysis'),
        fetch('/api/best-sellers-analysis')
      ]);

      if (!emissionsResponse.ok || !bestSellersResponse.ok) {
        throw new Error('Failed to fetch analysis data');
      }

      const [emissionsData, bestSellersData] = await Promise.all([
        emissionsResponse.json(),
        bestSellersResponse.json()
      ]);

      setData({
        emissions: { ...emissionsData, name: 'Low-Emission Products' },
        bestSellers: { ...bestSellersData, name: 'Best Sellers' }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return 'N/A';
    return value.toLocaleString('en-MY', { minimumFractionDigits: 2 });
  };

  const formatEmissions = (value: number | null | undefined) => {
    if (value == null) return 'N/A';
    return value.toLocaleString('en-MY', { minimumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        <p>Error: {error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-600 p-4">
        <p>No data available</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const emissionsComparisonData: ChartData<'bar'> = {
    labels: ['Low-Emission Products', 'Best Sellers'],
    datasets: [
      {
        label: 'Baseline Emissions (kg CO₂)',
        data: [
          data.emissions.emissionsAndOffset.baselineTotalEmissions,
          data.bestSellers.emissionsAndOffset.baselineTotalEmissions
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
      {
        label: 'New Emissions (kg CO₂)',
        data: [
          data.emissions.emissionsAndOffset.newTotalEmissions,
          data.bestSellers.emissionsAndOffset.newTotalEmissions
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1,
      }
    ],
  };

  const salesComparisonData: ChartData<'bar'> = {
    labels: ['Low-Emission Products', 'Best Sellers'],
    datasets: [
      {
        label: 'Baseline Revenue (RM)',
        data: [
          data.emissions.salesAndCosts?.baselineRevenue || 0,
          data.bestSellers.salesAndCosts?.baselineRevenue || 0
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
      {
        label: 'New Revenue (RM)',
        data: [
          data.emissions.salesAndCosts?.newRevenue || 0,
          data.bestSellers.salesAndCosts?.newRevenue || 0
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
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
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Only create financial comparison if both promotions have salesAndCosts data
  const showFinancialComparison = data.emissions.salesAndCosts && data.bestSellers.salesAndCosts;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Emissions Impact Comparison */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Environmental Impact Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[data.emissions, data.bestSellers].map((promo) => (
              <div key={promo.name} className="space-y-4">
                <h4 className="font-semibold text-lg">{promo.name}</h4>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Emissions Change</p>
                  <p className="text-xl font-bold">{formatEmissions(promo.emissionsAndOffset.incrementalEmissions)} kg CO2</p>
                  <p className="text-sm text-gray-600 mt-1">
                    ({((promo.emissionsAndOffset.newTotalEmissions / promo.emissionsAndOffset.baselineTotalEmissions - 1) * 100).toFixed(2)}% change)
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Carbon Offset Cost Change</p>
                  <p className="text-xl font-bold">RM {formatCurrency(promo.emissionsAndOffset.incrementalOffsetCost)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Bar options={chartOptions} data={emissionsComparisonData} />
          </div>
        </div>

        {/* Financial Impact Comparison - Only show if both promotions have financial data */}
        {showFinancialComparison && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Financial Impact Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[data.emissions, data.bestSellers].map((promo) => (
                <div key={promo.name} className="space-y-4">
                  <h4 className="font-semibold text-lg">{promo.name}</h4>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Revenue Change</p>
                    <p className="text-xl font-bold">
                      RM {formatCurrency(promo.salesAndCosts!.newRevenue - promo.salesAndCosts!.baselineRevenue)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      ({promo.salesAndCosts!.revenuePercentageChange.toFixed(2)}% change)
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Profit Impact</p>
                    <p className="text-xl font-bold">
                      RM {formatCurrency(promo.salesAndCosts!.incrementalProfit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Bar options={chartOptions} data={salesComparisonData} />
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Summary of Insights</h3>
          <div className="prose max-w-none">
            <h4 className="text-lg font-medium text-gray-900">Environmental Impact</h4>
            <ul className="list-disc pl-5 text-red-800 mt-2">
              <li>
                Low-Emission Products: {formatEmissions(data.emissions.emissionsAndOffset.incrementalEmissions)} kg CO2 increase
                (RM {formatCurrency(data.emissions.emissionsAndOffset.incrementalOffsetCost)} offset cost)
              </li>
              <li>
                Best Sellers: {formatEmissions(data.bestSellers.emissionsAndOffset.incrementalEmissions)} kg CO2 increase
                (RM {formatCurrency(data.bestSellers.emissionsAndOffset.incrementalOffsetCost)} offset cost)
              </li>
            </ul>

            {showFinancialComparison && (
              <>
                <h4 className="text-lg font-medium text-gray-900 mt-4">Financial Impact</h4>
                <ul className="list-disc pl-5 text-green-800 mt-2">
                  <li>
                    Low-Emission Products: RM {formatCurrency(data.emissions.salesAndCosts!.newRevenue - data.emissions.salesAndCosts!.baselineRevenue)} revenue increase
                    (RM {formatCurrency(data.emissions.salesAndCosts!.incrementalProfit)} profit impact)
                  </li>
                  <li>
                    Best Sellers: RM {formatCurrency(data.bestSellers.salesAndCosts!.newRevenue - data.bestSellers.salesAndCosts!.baselineRevenue)} revenue increase
                    (RM {formatCurrency(data.bestSellers.salesAndCosts!.incrementalProfit)} profit impact)
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 