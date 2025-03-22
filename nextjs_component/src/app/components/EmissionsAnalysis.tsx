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

interface EmissionsAnalysisProps {}

export default function EmissionsAnalysis() {
  const [products, setProducts] = useState<ProcessedProduct[]>([]);
  const [totals, setTotals] = useState<APIResponse['totals'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    setLoading(true);
    try {
      console.log('Fetching data from API...');
      const response = await fetch('/api/emissions');
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const rawData = await response.text();
      console.log('Raw API response:', rawData);

      let data: APIResponse;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        console.error('Failed to parse API response as JSON:', e);
        throw new Error('Invalid JSON response from API');
      }

      console.log('Parsed API response:', data);

      if (!data || !Array.isArray(data.products) || !data.totals) {
        console.error('Invalid data structure received:', data);
        throw new Error('Invalid data structure received from API');
      }

      if (data.products.length === 0) {
        console.error('No products received from API');
        throw new Error('No products received from API');
      }

      setProducts(data.products);
      setTotals(data.totals);
      console.log('Updated state - products:', data.products.length, 'products');
      console.log('Updated state - totals:', data.totals);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add state debugging
  useEffect(() => {
    console.log('Current products state:', products);
    console.log('Current totals state:', totals);
  }, [products, totals]);

  const chartData: ChartData<'bar'> = {
    labels: products.map(p => `Product ${p.productKey}`),
    datasets: [
      {
        label: 'Baseline Sales (RM)',
        data: products.map(p => p.baselineSales),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
      {
        label: 'Projected Sales with 20% Discount (RM)',
        data: products.map(p => p.projectedSales),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1,
      }
    ],
  };

  const emissionsChartData: ChartData<'bar'> = {
    labels: products.map(p => `Product ${p.productKey}`),
    datasets: [
      {
        label: 'Baseline Emissions (kg CO2)',
        data: products.map(p => p.totalEmissions),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
      {
        label: 'Projected Emissions (kg CO2)',
        data: products.map(p => p.totalEmissions * (1 + p.percentageVolumeIncrease / 100)),
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        borderColor: 'rgb(255, 159, 64)',
        borderWidth: 1,
      }
    ],
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

  // Calculate total emissions change
  const baselineTotalEmissions = products.reduce((sum, p) => sum + p.totalEmissions, 0);
  const projectedTotalEmissions = products.reduce((sum, p) => sum + (p.totalEmissions * (1 + p.percentageVolumeIncrease / 100)), 0);
  const emissionsChange = ((projectedTotalEmissions - baselineTotalEmissions) / baselineTotalEmissions) * 100;
  
  // Carbon offsetting costs (0.25 RM/kgCO2)
  const CARBON_OFFSET_RATE = 0.25; // RM per kg CO2
  
  // Calculate per-unit offsetting costs for each product
  const productsWithOffsetCosts = products.map(product => ({
    ...product,
    offsetCostPerUnit: product.totalEmissions * CARBON_OFFSET_RATE,
  }));

  const averageOffsetCostPerUnit = productsWithOffsetCosts.reduce((sum, p) => sum + p.offsetCostPerUnit, 0) / products.length;

  const options: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Sales Impact of 20% Discount on Low-Emission Products',
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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Low-Emission Products Promotion</h2>

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
      ) : products.length === 0 ? (
        <div className="text-center text-gray-600">No data available</div>
      ) : (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">July 2024 Promotion Impact Analysis</h2>
          
          {/* Company-wide metrics */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">July Company-wide Impact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Baseline Revenue</p>
                  <p className="text-2xl font-bold">RM {totals?.companyBaselineRevenue.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Projected Revenue</p>
                  <p className="text-2xl font-bold">RM {totals?.companyProjectedRevenue.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Revenue Change</p>
                  <p className="text-2xl font-bold">{totals?.companyRevenueChange.toFixed(2) ?? '0.00'}%</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Promoted Products Share</p>
                  <p className="text-2xl font-bold">{totals?.promotedProductsShareOfRevenue.toFixed(2) ?? '0.00'}%</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Carbon Footprint</p>
                  <p className="text-2xl font-bold">{baselineTotalEmissions.toFixed(2)} kg CO2</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Projected Carbon Footprint</p>
                  <p className="text-2xl font-bold">{projectedTotalEmissions.toFixed(2)} kg CO2</p>
                </div>
                <div className="col-span-2 bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Revenue Change</p>
                  <p className="text-2xl font-bold">{totals?.promotedProductsRevenueChange.toFixed(2) ?? '0.00'}%</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4">July Promotion Impact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Baseline Revenue</p>
                  <p className="text-2xl font-bold">RM {totals?.promotedProductsBaselineRevenue.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">July Projected Revenue</p>
                  <p className="text-2xl font-bold">RM {totals?.promotedProductsProjectedRevenue.toLocaleString('en-MY', { minimumFractionDigits: 2 }) ?? '0.00'}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg col-span-2">
                  <p className="text-sm text-gray-600">Carbon Offsetting Costs (Per Unit)</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Average Cost per Unit</p>
                      <p className="text-lg font-semibold">RM {averageOffsetCostPerUnit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lowest Cost per Unit</p>
                      <p className="text-lg font-semibold">RM {Math.min(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Highest Cost per Unit</p>
                      <p className="text-lg font-semibold">RM {Math.max(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg col-span-2">
                  <p className="text-sm text-gray-600">Emissions Change</p>
                  <p className="text-2xl font-bold">{emissionsChange.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Product details */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="mb-4">
              <p className="text-gray-600">Showing July sales impact for the 10 products with lowest emissions per unit</p>
            </div>
            <div className="h-[400px]">
              <Bar options={options} data={chartData} />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Emissions Impact</h3>
              <div className="h-[400px]">
                <Bar options={emissionsChartOptions} data={emissionsChartData} />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Product Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-right">Total Emissions (kg CO2)</th>
                      <th className="px-4 py-2 text-right">Offset Cost per Unit (RM)</th>
                      <th className="px-4 py-2 text-right">Baseline Sales (RM)</th>
                      <th className="px-4 py-2 text-right">Projected Sales (RM)</th>
                      <th className="px-4 py-2 text-right">Volume Increase (%)</th>
                      <th className="px-4 py-2 text-right">Revenue Change (%)</th>
                      <th className="px-4 py-2 text-right">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsWithOffsetCosts.map((product) => (
                      <tr key={product.productKey} className="border-b">
                        <td className="px-4 py-2">Product {product.productKey}</td>
                        <td className="px-4 py-2 text-right">{product.totalEmissions.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{product.offsetCostPerUnit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right">{product.baselineSales.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right">{product.projectedSales.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right">{product.percentageVolumeIncrease.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right">{product.percentageRevenueChange.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right">{(product.marginPercent * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Story Section */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-sm">
        <h3 className="text-xl font-semibold mb-4">July 2024 Low-Emission Products Promotion Analysis</h3>
        
        <div className="space-y-4 text-gray-700">
          <p>
            <strong>Promotion Overview:</strong> From July 1st to July 31st 2024, we will be offering a 20% discount 
            on our 10 products with the lowest carbon emissions per unit. This month-long promotion aims to boost 
            sales of environmentally-friendly products during the peak summer season.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Revenue Impact Analysis</h4>
            <p className="text-blue-800">
              The promotion is expected to deliver significant financial benefits:
            </p>
            <ul className="list-disc pl-5 text-blue-800 mt-2">
              <li>Current July Revenue: RM {(totals?.companyBaselineRevenue || 0).toLocaleString()}</li>
              <li>Promoted Products Current Revenue: RM {(totals?.promotedProductsBaselineRevenue || 0).toLocaleString()} ({totals?.promotedProductsShareOfRevenue.toFixed(1)}% of total)</li>
              <li>Projected July Revenue: RM {(totals?.companyProjectedRevenue || 0).toLocaleString()}</li>
              <li>Overall Revenue Change: {totals?.companyRevenueChange.toFixed(2)}%</li>
              <li>Promoted Products Revenue Change: {totals?.promotedProductsRevenueChange.toFixed(2)}%</li>
            </ul>
            <p className="text-blue-800 mt-2">
              The promotion's revenue impact is driven by a combination of increased volume and strategic pricing. 
              While the 20% discount reduces the per-unit revenue, the expected volume increase of 51.4% more than 
              compensates for the price reduction, leading to a projected revenue increase of 21.2% for the promoted products.
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">Environmental Impact</h4>
            <p className="text-green-800">
              The selected products demonstrate exceptional environmental performance:
            </p>
            <ul className="list-disc pl-5 text-green-800 mt-2">
              <li>Lowest Emissions Product: {products[0]?.totalEmissions.toFixed(2)} kg CO2 per unit</li>
              <li>Highest Emissions Among Selected: {products[9]?.totalEmissions.toFixed(2)} kg CO2 per unit</li>
              <li>Average Emissions per Unit: {(products.reduce((acc, p) => acc + p.totalEmissions, 0) / products.length).toFixed(2)} kg CO2</li>
              <li>Average Offset Cost per Unit: RM {averageOffsetCostPerUnit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</li>
              <li>Lowest Offset Cost per Unit: RM {Math.min(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</li>
              <li>Highest Offset Cost per Unit: RM {Math.max(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</li>
            </ul>
            <p className="text-green-800 mt-2">
              These products represent our most environmentally-friendly options, with carbon offsetting costs ranging from 
              RM {Math.min(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2 })} to 
              RM {Math.max(...productsWithOffsetCosts.map(p => p.offsetCostPerUnit)).toLocaleString('en-MY', { minimumFractionDigits: 2 })} per unit. 
              The average offset cost of RM {averageOffsetCostPerUnit.toLocaleString('en-MY', { minimumFractionDigits: 2 })} per unit 
              reflects the low-emission profile of these selected products.
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2">Sales Performance Analysis</h4>
            <p className="text-purple-800">
              The promotion is expected to drive significant volume growth across all promoted products:
            </p>
            <ul className="list-disc pl-5 text-purple-800 mt-2">
              <li>Average Volume Increase: {products.reduce((acc, p) => acc + p.percentageVolumeIncrease, 0) / products.length}%</li>
              <li>Average Revenue Change: {products.reduce((acc, p) => acc + p.percentageRevenueChange, 0) / products.length}%</li>
              <li>Average Margin: {products.reduce((acc, p) => acc + p.marginPercent, 0) / products.length * 100}%</li>
            </ul>
            <p className="text-purple-800 mt-2">
              The promotion's success is underpinned by strong price elasticity among our environmentally conscious 
              customer base, with volume increases more than offsetting the price reductions.
            </p>
          </div>
          
          <p className="mt-4">
            <strong>Strategic Value:</strong> This promotion represents a win-win strategy, combining environmental 
            responsibility with business growth. By offering discounts on our lowest-emission products during July's 
            peak shopping season, we're not only driving revenue growth but also positioning ourselves as a leader 
            in sustainable retail practices. The promotion's timing aligns perfectly with increased summer shopping 
            activity, maximizing its potential impact on both sales and sustainability goals.
          </p>
        </div>
      </div>
    </div>
  );
}