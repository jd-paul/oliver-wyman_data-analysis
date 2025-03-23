import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

// Only keep the interfaces we actually use in type annotations
interface Sale {
  ProductKey: string;
  TransactionMonth: string;
  EstimatedUnitVolume: string;
  PredictedPrice: string;
  EstimatedSales: string;
}

interface Product {
  ProductKey: string;
  BrandKey: string;
  SupplierKey: string;
  ProductCategory_Lvl1: string;
  ProductCategory_Lvl2: string;
  Margin: string;
  Elasticity: string;
}

interface Category {
  ProductCategory_Lvl1: string;
  ProductCategory_Lvl2: string;
  Est_Emission_Int: string;
  Units: string;
}

interface Brand {
  BrandKey: string;
  Est_Emission_Int: string;
  Units: string;
}

interface Supplier {
  SupplierKey: string;
  'Distance /mi': string;
  Est_Emission_Int: string;
  Units: string;
}

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

const CARBON_OFFSET_RATE = 0.25; // RM per kg CO2
const DISCOUNT_PERCENT = 0.15; // 15% discount

// Helper function to convert emissions to kg CO2 (matching category-wide)
function convertToKgCO2(value: number, units: string): number {
  if (units.toLowerCase() === 'g co2') {
    return value / 1000; // Convert g to kg
  }
  return value; // Already in kg
}

export async function GET() {
  try {
    console.log('Starting supplier analysis...');

    // Read and parse CSV files (using Promise.all like category-wide)
    const csvDir = path.join(process.cwd(), 'public', 'CSVs');
    const [salesData, productData, categoryData, brandData, supplierData] = await Promise.all([
      fs.promises.readFile(path.join(csvDir, 'Monthly_sales_forecast.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_category_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'brand_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'supplier_table.csv'), 'utf-8')
    ].map(p => p.then(data => parse(data, { columns: true }))));

    console.log('CSV files parsed successfully');

    // Filter for July sales and target supplier
    const julySales = (salesData as Sale[]).filter(record => record.TransactionMonth === '7');
    const targetSupplierKey = '1098896101';
    const supplierProducts = (productData as Product[]).filter(p => p.SupplierKey === targetSupplierKey);
    
    console.log(`Found ${julySales.length} July sales records`);
    console.log(`Found ${supplierProducts.length} products from target supplier`);

    // Process products
    const processedProducts: ProcessedProduct[] = [];

    julySales.forEach((sale: Sale) => {
      const product = supplierProducts.find(p => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const category = (categoryData as Category[]).find(c => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 &&
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = (brandData as Brand[]).find(b => b.BrandKey === product.BrandKey);
      const supplier = (supplierData as Supplier[]).find(s => s.SupplierKey === product.SupplierKey);

      // Calculate emissions components (matching category-wide approach)
      const categoryEmissions = category ? convertToKgCO2(parseFloat(category.Est_Emission_Int), category.Units) : 0;
      const brandEmissions = brand ? parseFloat(brand.Est_Emission_Int) : 0;
      const supplierEmissions = supplier ? 
        parseFloat(supplier['Distance /mi']) * parseFloat(supplier.Est_Emission_Int) : 0;

      // Total emissions per unit (direct sum like category-wide)
      const totalEmissionsPerUnit = categoryEmissions + brandEmissions + supplierEmissions;

      // Parse values
      const originalPrice = parseFloat(sale.PredictedPrice);
      const originalVolume = parseFloat(sale.EstimatedUnitVolume);
      const elasticity = parseFloat(product.Elasticity);
      const marginPercent = parseFloat(product.Margin.replace('%', '')) / 100;

      // Calculate new price and volume
      const newPrice = originalPrice * (1 - DISCOUNT_PERCENT);
      const newVolume = originalVolume * (1 + elasticity * DISCOUNT_PERCENT);

      // Calculate sales (matching category-wide approach)
      const originalSales = originalVolume * originalPrice;
      const newSales = newVolume * newPrice;
      const salesUplift = newSales - originalSales;

      // Calculate profits (matching category-wide approach - directly from sales)
      const originalGrossProfit = originalSales * marginPercent;
      const newGrossProfit = newSales * marginPercent;

      // Calculate emissions and offset costs (matching category-wide approach)
      const originalEmissions = originalVolume * totalEmissionsPerUnit;
      const newEmissions = newVolume * totalEmissionsPerUnit;
      const originalOffsetCost = originalEmissions * CARBON_OFFSET_RATE;
      const newOffsetCost = newEmissions * CARBON_OFFSET_RATE;
      const offsetCostChange = newOffsetCost - originalOffsetCost;

      // Calculate final profits (matching category-wide approach)
      const originalProfit = originalGrossProfit;
      const newProfit = newGrossProfit;
      const profitUplift = newProfit - originalProfit;

      processedProducts.push({
        productKey: sale.ProductKey,
        originalPrice,
        newPrice,
        originalVolume,
        newVolume,
        originalSales,
        newSales,
        salesUplift,
        marginPercent,
        originalGrossProfit,
        newGrossProfit,
        originalProfit,
        newProfit,
        profitUplift,
        originalEmissions,
        newEmissions,
        originalOffsetCost,
        newOffsetCost,
        offsetCostChange,
        totalEmissionsPerUnit
      });
    });

    // Add descriptive statistics (matching category-wide)
    const getDescriptiveStats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const count = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / count;
      const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count);
      return {
        count,
        mean,
        std,
        min: sorted[0],
        '25%': sorted[Math.floor(count * 0.25)],
        '50%': sorted[Math.floor(count * 0.5)],
        '75%': sorted[Math.floor(count * 0.75)],
        max: sorted[count - 1]
      };
    };

    // Log descriptive statistics
    console.log('\n=== Descriptive Statistics for Key Columns ===');
    console.log('Volume, Price, Sales:');
    console.log(getDescriptiveStats(processedProducts.map(p => p.originalVolume)));
    console.log(getDescriptiveStats(processedProducts.map(p => p.originalPrice)));
    console.log(getDescriptiveStats(processedProducts.map(p => p.originalSales)));
    
    console.log('\nMargin:');
    console.log(getDescriptiveStats(processedProducts.map(p => p.marginPercent)));
    
    console.log('\nEmissions per unit:');
    console.log(getDescriptiveStats(processedProducts.map(p => p.totalEmissionsPerUnit)));

    // Calculate summary metrics
    const summary = {
      originalTotalSales: processedProducts.reduce((sum, p) => sum + p.originalSales, 0),
      newTotalSales: processedProducts.reduce((sum, p) => sum + p.newSales, 0),
      totalSalesUplift: processedProducts.reduce((sum, p) => sum + p.salesUplift, 0),
      originalTotalProfit: processedProducts.reduce((sum, p) => sum + p.originalProfit, 0),
      newTotalProfit: processedProducts.reduce((sum, p) => sum + p.newProfit, 0),
      totalProfitUplift: processedProducts.reduce((sum, p) => sum + p.profitUplift, 0),
      originalTotalEmissions: processedProducts.reduce((sum, p) => sum + p.originalEmissions, 0),
      newTotalEmissions: processedProducts.reduce((sum, p) => sum + p.newEmissions, 0),
      totalEmissionsChange: processedProducts.reduce((sum, p) => sum + (p.newEmissions - p.originalEmissions), 0),
      originalTotalOffsetCost: processedProducts.reduce((sum, p) => sum + p.originalOffsetCost, 0),
      newTotalOffsetCost: processedProducts.reduce((sum, p) => sum + p.newOffsetCost, 0),
      totalOffsetCostChange: processedProducts.reduce((sum, p) => sum + p.offsetCostChange, 0)
    };

    // Log verification (matching category-wide format)
    console.log('\n=== Sales & Costs Analysis ===');
    console.log(`Baseline Total Sales: RM ${summary.originalTotalSales.toFixed(2)}`);
    console.log(`New Total Sales: RM ${summary.newTotalSales.toFixed(2)}`);
    console.log(`Incremental Sales: RM ${summary.totalSalesUplift.toFixed(2)}\n`);

    console.log(`Baseline Total Profit: RM ${summary.originalTotalProfit.toFixed(2)}`);
    console.log(`New Total Profit: RM ${summary.newTotalProfit.toFixed(2)}`);
    console.log(`Incremental Profit: RM ${summary.totalProfitUplift.toFixed(2)}\n`);

    console.log('=== Emissions & Offset Cost Analysis ===');
    console.log(`Baseline Total Emissions: ${summary.originalTotalEmissions.toFixed(2)} kg CO₂`);
    console.log(`New Total Emissions: ${summary.newTotalEmissions.toFixed(2)} kg CO₂`);
    console.log(`Incremental Emissions: ${summary.totalEmissionsChange.toFixed(2)} kg CO₂\n`);

    console.log(`Baseline Offset Cost: RM ${summary.originalTotalOffsetCost.toFixed(2)}`);
    console.log(`New Offset Cost: RM ${summary.newTotalOffsetCost.toFixed(2)}`);
    console.log(`Incremental Offset Cost: RM ${summary.totalOffsetCostChange.toFixed(2)}\n`);

    const response = {
      products: processedProducts,
      summary
    };

    console.log('Supplier analysis completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in supplier analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process supplier analysis' },
      { status: 500 }
    );
  }
} 