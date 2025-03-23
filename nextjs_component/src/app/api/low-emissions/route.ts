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

const CARBON_OFFSET_RATE = 0.25; // RM per kg CO2
const DISCOUNT_RATE = 0.20; // 20% discount for low-emission products
const TOP_N_PRODUCTS = 10; // Number of lowest emission products to select

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

    // First, create a merged dataset similar to Python's approach
    interface MergedRecord {
      ProductKey: string;
      TransactionMonth: string;
      EstimatedUnitVolume: number;
      PredictedPrice: number;
      EstimatedSales: number;
      Margin: number;
      Elasticity: number;
      CategoryEmissions: number;
      BrandEmissions: number;
      SupplierEmissions: number;
      Total_Emission_per_unit: number;
      NewPrice: number;
      NewVolume: number;
      BaselineSales: number;
      NewSales: number;
      BaselineProfit: number;
      NewProfit: number;
      BaselineEmissions: number;
      NewEmissions: number;
      BaselineOffsetCost: number;
      NewOffsetCost: number;
    }

    // Create merged dataset (similar to Python's pd.merge operations)
    const mergedData: MergedRecord[] = [];
    
    // Filter for July sales first
    const julySales = salesData.filter((sale: SalesRecord) => sale.TransactionMonth === '7');
    
    julySales.forEach((sale: SalesRecord) => {
      const product = productData.find((p: Product) => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const category = categoryData.find((c: Category) => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 && 
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brandData.find((b: Brand) => b.BrandKey === product.BrandKey);
      const supplier = supplierData.find((s: Supplier) => s.SupplierKey === product.SupplierKey);

      // Calculate emissions components
      const categoryEmissions = category ? convertToKgCO2(parseFloat(category.Est_Emission_Int), category.Units) : 0;
      const brandEmissions = brand ? parseFloat(brand.Est_Emission_Int) : 0;
      const supplierEmissions = supplier ? 
        parseFloat(supplier['Distance /mi']) * parseFloat(supplier.Est_Emission_Int) : 0;

      // Total emissions per unit (direct sum like Python)
      const totalEmissionPerUnit = categoryEmissions + brandEmissions + supplierEmissions;

      // Create merged record with all necessary fields
      const record: MergedRecord = {
        ProductKey: sale.ProductKey,
        TransactionMonth: sale.TransactionMonth,
        EstimatedUnitVolume: parseFloat(sale.EstimatedUnitVolume),
        PredictedPrice: parseFloat(sale.PredictedPrice),
        EstimatedSales: parseFloat(sale.EstimatedSales),
        Margin: parseFloat(product.Margin.replace('%', '')) / 100,
        Elasticity: parseFloat(product.Elasticity),
        CategoryEmissions: categoryEmissions,
        BrandEmissions: brandEmissions,
        SupplierEmissions: supplierEmissions,
        Total_Emission_per_unit: totalEmissionPerUnit,
        NewPrice: 0,
        NewVolume: 0,
        BaselineSales: 0,
        NewSales: 0,
        BaselineProfit: 0,
        NewProfit: 0,
        BaselineEmissions: 0,
        NewEmissions: 0,
        BaselineOffsetCost: 0,
        NewOffsetCost: 0
      };

      // Calculate new price and volume (like Python)
      record.NewPrice = record.PredictedPrice * (1 - DISCOUNT_RATE);
      record.NewVolume = record.EstimatedUnitVolume * (1 + record.Elasticity * DISCOUNT_RATE);

      // Calculate sales (like Python df['BaselineSales'] = df['EstimatedUnitVolume'] * df['PredictedPrice'])
      record.BaselineSales = record.EstimatedUnitVolume * record.PredictedPrice;
      record.NewSales = record.NewVolume * record.NewPrice;

      // Calculate profits (like Python df['BaselineProfit'] = df['BaselineSales'] * df['Margin'])
      record.BaselineProfit = record.BaselineSales * record.Margin;
      record.NewProfit = record.NewSales * record.Margin;

      // Calculate emissions (like Python df['BaselineEmissions'] = df['EstimatedUnitVolume'] * df['Total_Emission_per_unit'])
      record.BaselineEmissions = record.EstimatedUnitVolume * record.Total_Emission_per_unit;
      record.NewEmissions = record.NewVolume * record.Total_Emission_per_unit;

      // Calculate offset costs (like Python df['BaselineOffsetCost'] = df['BaselineEmissions'] * offset_rate)
      record.BaselineOffsetCost = record.BaselineEmissions * CARBON_OFFSET_RATE;
      record.NewOffsetCost = record.NewEmissions * CARBON_OFFSET_RATE;

      mergedData.push(record);
    });

    // Sort by emissions per unit to find lowest emission products
    const sortedByEmissions = [...mergedData].sort((a, b) => a.Total_Emission_per_unit - b.Total_Emission_per_unit);
    const selectedProducts = sortedByEmissions.slice(0, TOP_N_PRODUCTS);

    // Calculate totals for selected products
    const baselineTotalSales = selectedProducts.reduce((sum, record) => sum + record.BaselineSales, 0);
    const newTotalSales = selectedProducts.reduce((sum, record) => sum + record.NewSales, 0);
    
    const baselineTotalProfit = selectedProducts.reduce((sum, record) => sum + record.BaselineProfit, 0);
    const newTotalProfit = selectedProducts.reduce((sum, record) => sum + record.NewProfit, 0);
    
    const baselineTotalEmissions = selectedProducts.reduce((sum, record) => sum + record.BaselineEmissions, 0);
    const newTotalEmissions = selectedProducts.reduce((sum, record) => sum + record.NewEmissions, 0);
    
    const baselineTotalOffsetCost = selectedProducts.reduce((sum, record) => sum + record.BaselineOffsetCost, 0);
    const newTotalOffsetCost = selectedProducts.reduce((sum, record) => sum + record.NewOffsetCost, 0);

    // Calculate incremental ratios
    const salesIncrRatio = (newTotalSales - baselineTotalSales) / baselineTotalSales;
    const profitIncrRatio = (newTotalProfit - baselineTotalProfit) / baselineTotalProfit;
    const emissionsIncrRatio = (newTotalEmissions - baselineTotalEmissions) / baselineTotalEmissions;
    const offsetIncrRatio = (newTotalOffsetCost - baselineTotalOffsetCost) / baselineTotalOffsetCost;

    // Add descriptive statistics (like Python's df.describe())
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

    // Log descriptive statistics like Python
    console.log('\n=== Descriptive Statistics for Key Columns ===');
    console.log('EstimatedUnitVolume, PredictedPrice, EstimatedSales:');
    console.log(getDescriptiveStats(selectedProducts.map(r => r.EstimatedUnitVolume)));
    console.log(getDescriptiveStats(selectedProducts.map(r => r.PredictedPrice)));
    console.log(getDescriptiveStats(selectedProducts.map(r => r.EstimatedSales)));
    
    console.log('\nMargin (as numeric):');
    console.log(getDescriptiveStats(selectedProducts.map(r => r.Margin)));
    
    console.log('\nTotal Emission per unit:');
    console.log(getDescriptiveStats(selectedProducts.map(r => r.Total_Emission_per_unit)));

    // Sample of product-level data
    console.log('\n=== Sample of Product-Level Data ===');
    selectedProducts.slice(0, 5).forEach(record => {
      console.log({
        ProductKey: record.ProductKey,
        EstimatedUnitVolume: record.EstimatedUnitVolume,
        NewVolume: record.NewVolume,
        PredictedPrice: record.PredictedPrice,
        NewPrice: record.NewPrice
      });
    });

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
      discountRate: DISCOUNT_RATE
    };

    // Log verification
    console.log('\n=== Sales & Costs Analysis ===');
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
    console.error('Error in low-emissions analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process low-emissions analysis' },
      { status: 500 }
    );
  }
} 