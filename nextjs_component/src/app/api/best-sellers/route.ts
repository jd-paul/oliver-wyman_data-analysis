import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

interface SalesRecord {
  ProductKey: string;
  TransactionMonth: string;
  EstimatedUnitVolume: string;
  PredictedPrice: string;
  EstimatedSales: string;
}

interface ProductRecord {
  ProductKey: string;
  BrandKey: string;
  SupplierKey: string;
  ProductCategory_Lvl1: string;
  ProductCategory_Lvl2: string;
  Margin: string;
  Elasticity: string;
}

interface CategoryRecord {
  ProductCategory_Lvl1: string;
  ProductCategory_Lvl2: string;
  Est_Emission_Int: string;
  Units: string;
}

interface BrandRecord {
  BrandKey: string;
  Est_Emission_Int: string;
  Units: string;
}

interface SupplierRecord {
  SupplierKey: string;
  'Distance /mi': string;
  Est_Emission_Int: string;
  Units: string;
}

const CARBON_OFFSET_RATE = 0.25; // RM per kg CO2
const DISCOUNT_RATE = 0.10; // 10% discount for best sellers
const BEST_SELLER_THRESHOLD = 0.9; // Top 10% products

// Helper function to convert emissions to kg CO2
function convertToKgCO2(value: number, units: string): number {
  if (units.toLowerCase() === 'g co2') {
    return value / 1000; // Convert g to kg
  }
  return value; // Already in kg
}

export async function GET() {
  try {
    // Read and parse CSV files
    const csvDir = path.join(process.cwd(), 'public', 'CSVs');
    const [salesData, productData, categoryData, brandData, supplierData] = await Promise.all([
      fs.promises.readFile(path.join(csvDir, 'Monthly_sales_forecast.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_category_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'brand_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'supplier_table.csv'), 'utf-8')
    ].map(p => p.then(data => parse(data, { columns: true }))));

    // Filter for July sales first
    const julySales = salesData.filter((sale: SalesRecord) => sale.TransactionMonth === '7');
    console.log(`Found ${julySales.length} sales records for July`);

    // Sort July sales by EstimatedSales to find top 10 best sellers
    const sortedJulySales = [...julySales].sort((a, b) => 
      parseFloat(b.EstimatedSales) - parseFloat(a.EstimatedSales)
    );
    const top10BestSellers = sortedJulySales.slice(0, 10);
    console.log(`Selected top 10 best-selling products for July`);

    // Calculate total emissions per unit for each product
    const totalEmissionsPerUnit: { [key: string]: number } = {};
    productData.forEach((product: ProductRecord) => {
      const category = categoryData.find((c: CategoryRecord) => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 && 
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brandData.find((b: BrandRecord) => b.BrandKey === product.BrandKey);
      const supplier = supplierData.find((s: SupplierRecord) => s.SupplierKey === product.SupplierKey);

      // Direct sum of emissions like Python implementation
      const categoryEmissions = category ? convertToKgCO2(parseFloat(category.Est_Emission_Int), category.Units) : 0;
      const brandEmissions = brand ? convertToKgCO2(parseFloat(brand.Est_Emission_Int), brand.Units) : 0;
      const supplierEmissions = supplier ? 
        parseFloat(supplier['Distance /mi']) * convertToKgCO2(parseFloat(supplier.Est_Emission_Int), supplier.Units) : 0;

      totalEmissionsPerUnit[product.ProductKey] = categoryEmissions + brandEmissions + supplierEmissions;
    });

    // Calculate baseline metrics
    let baselineTotalSales = 0;
    let baselineTotalProfit = 0;
    let baselineTotalEmissions = 0;
    let baselineTotalOffsetCost = 0;

    // Calculate new metrics with discount
    let newTotalSales = 0;
    let newTotalProfit = 0;
    let newTotalEmissions = 0;
    let newTotalOffsetCost = 0;

    // Process each sale (now only top 10 best sellers)
    top10BestSellers.forEach((sale: SalesRecord) => {
      const product = productData.find((p: ProductRecord) => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const originalPrice = parseFloat(sale.PredictedPrice);
      const originalVolume = parseFloat(sale.EstimatedUnitVolume);
      const margin = parseFloat(product.Margin.replace('%', '')) / 100;
      const elasticity = parseFloat(product.Elasticity);
      const emissionsPerUnit = totalEmissionsPerUnit[sale.ProductKey] || 0;

      // Calculate baseline metrics (like Python implementation)
      const baselineSales = originalPrice * originalVolume;
      const baselineProfit = baselineSales * margin;
      const baselineEmissions = originalVolume * emissionsPerUnit;
      const baselineOffsetCost = baselineEmissions * CARBON_OFFSET_RATE;

      // Calculate new metrics with discount (for all top 10 products)
      const newPrice = originalPrice * (1 - DISCOUNT_RATE);
      const newVolume = originalVolume * (1 + elasticity * DISCOUNT_RATE);
      const newSales = newPrice * newVolume;
      const newProfit = newSales * margin;
      const newEmissions = newVolume * emissionsPerUnit;
      const newOffsetCost = newEmissions * CARBON_OFFSET_RATE;

      // Add to totals
      baselineTotalSales += baselineSales;
      baselineTotalProfit += baselineProfit;
      baselineTotalEmissions += baselineEmissions;
      baselineTotalOffsetCost += baselineOffsetCost;

      newTotalSales += newSales;
      newTotalProfit += newProfit;
      newTotalEmissions += newEmissions;
      newTotalOffsetCost += newOffsetCost;
    });

    // Calculate incremental ratios
    const salesIncrRatio = (newTotalSales - baselineTotalSales) / baselineTotalSales;
    const profitIncrRatio = (newTotalProfit - baselineTotalProfit) / baselineTotalProfit;
    const emissionsIncrRatio = (newTotalEmissions - baselineTotalEmissions) / baselineTotalEmissions;
    const offsetIncrRatio = (newTotalOffsetCost - baselineTotalOffsetCost) / baselineTotalOffsetCost;

    const response = {
      baseline: {
        totalSales: baselineTotalSales,
        totalProfit: baselineTotalProfit,
        totalEmissions: baselineTotalEmissions,
        totalOffsetCost: baselineTotalOffsetCost
      },
      new: {
        totalSales: newTotalSales,
        totalProfit: newTotalProfit,
        totalEmissions: newTotalEmissions,
        totalOffsetCost: newTotalOffsetCost
      },
      incremental: {
        sales: newTotalSales - baselineTotalSales,
        profit: newTotalProfit - baselineTotalProfit,
        emissions: newTotalEmissions - baselineTotalEmissions,
        offsetCost: newTotalOffsetCost - baselineTotalOffsetCost
      },
      ratios: {
        sales: salesIncrRatio,
        profit: profitIncrRatio,
        emissions: emissionsIncrRatio,
        offsetCost: offsetIncrRatio
      },
      discountRate: DISCOUNT_RATE,
      bestSellerThreshold: parseFloat(top10BestSellers[9]?.EstimatedSales || '0') // Sales threshold of the 10th best seller
    };

    // Log verification
    console.log('\n=== Sales & Costs Analysis (Top 10 Best Sellers in July) ===');
    console.log(`Baseline Total Sales: RM ${baselineTotalSales.toFixed(2)}`);
    console.log(`New Total Sales: RM ${newTotalSales.toFixed(2)}`);
    console.log(`Incremental Sales: RM ${(newTotalSales - baselineTotalSales).toFixed(2)}\n`);

    console.log(`Baseline Total Profit: RM ${baselineTotalProfit.toFixed(2)}`);
    console.log(`New Total Profit: RM ${newTotalProfit.toFixed(2)}`);
    console.log(`Incremental Profit: RM ${(newTotalProfit - baselineTotalProfit).toFixed(2)}\n`);

    console.log('=== Emissions & Offset Cost Analysis ===');
    console.log(`Baseline Total Emissions: ${baselineTotalEmissions.toFixed(2)} kg CO₂`);
    console.log(`New Total Emissions: ${newTotalEmissions.toFixed(2)} kg CO₂`);
    console.log(`Incremental Emissions: ${(newTotalEmissions - baselineTotalEmissions).toFixed(2)} kg CO₂\n`);

    console.log(`Baseline Offset Cost: RM ${baselineTotalOffsetCost.toFixed(2)}`);
    console.log(`New Offset Cost: RM ${newTotalOffsetCost.toFixed(2)}`);
    console.log(`Incremental Offset Cost: RM ${(newTotalOffsetCost - baselineTotalOffsetCost).toFixed(2)}\n`);

    console.log('=== Incremental Ratios ===');
    console.log(`Incremental Sales / Baseline Sales Ratio: ${(salesIncrRatio * 100).toFixed(2)}%`);
    console.log(`Incremental Profit / Baseline Profit Ratio: ${(profitIncrRatio * 100).toFixed(2)}%`);
    console.log(`Incremental Emissions / Baseline Emissions Ratio: ${(emissionsIncrRatio * 100).toFixed(2)}%`);
    console.log(`Incremental Offset Cost / Baseline Offset Cost Ratio: ${(offsetIncrRatio * 100).toFixed(2)}%`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in best-sellers analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process best-sellers analysis' },
      { status: 500 }
    );
  }
}