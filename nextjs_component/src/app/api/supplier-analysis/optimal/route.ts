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

interface SupplierRecord {
  SupplierKey: string;
  'Distance /mi': string;
  Est_Emission_Int: string;
  Units: string;
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

const CARBON_OFFSET_RATE = 0.25; // RM per kg CO2
const BONUS_THRESHOLD = 2_000_000; // RM
const BONUS_AMOUNT = 50_000; // RM
const TARGET_SUPPLIER = '1098896101';

function calculateMetricsForDiscount(
  discount: number,
  salesData: SalesRecord[],
  productData: ProductRecord[],
  totalEmissionsPerUnit: { [key: string]: number }
): { totalSales: number; totalNetProfit: number } {
  let totalSales = 0;
  let totalNetProfit = 0;

  salesData.forEach((sale: SalesRecord) => {
    const product = productData.find((p: ProductRecord) => p.ProductKey === sale.ProductKey);
    if (!product) return;

    // Step 1: New price after discount
    const originalPrice = parseFloat(sale.PredictedPrice);
    const newPrice = originalPrice * (1 - discount);

    // Step 2: % change in price
    const pctPriceChange = (newPrice - originalPrice) / originalPrice;

    // Step 3: Volume response using elasticity
    const elasticity = parseFloat(product.Elasticity);
    const pctVolumeChange = -elasticity * pctPriceChange;
    const originalVolume = parseFloat(sale.EstimatedUnitVolume);
    const newVolume = Math.max(0, originalVolume * (1 + pctVolumeChange));

    // Step 4: Recalculate sales and profit
    const newSales = newPrice * newVolume;
    const margin = parseFloat(product.Margin.replace('%', '')) / 100;
    const newGrossProfit = newSales * margin;

    // Step 5: Emissions and offset cost
    const emissionsPerUnit = totalEmissionsPerUnit[sale.ProductKey] || 0;
    const newEmissions = newVolume * emissionsPerUnit;
    const offsetCost = newEmissions * CARBON_OFFSET_RATE;

    // Step 6: Net profit = gross profit − offset cost
    const newNetProfit = newGrossProfit - offsetCost;

    totalSales += newSales;
    totalNetProfit += newNetProfit;
  });

  // Step 7: Bonus condition
  if (totalSales > BONUS_THRESHOLD) {
    totalNetProfit += BONUS_AMOUNT;
  }

  return { totalSales, totalNetProfit };
}

function goldenSectionSearch(
  f: (x: number) => number,
  a: number = 0.05,
  b: number = 0.5,
  tolerance: number = 1e-4,
  maxIter: number = 50
): { bestDiscount: number } {
  const gr = (Math.sqrt(5) + 1) / 2; // golden ratio ≈ 1.618
  let c = b - (b - a) / gr;
  let d = a + (b - a) / gr;

  let fc = f(c);
  let fd = f(d);

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(b - a) < tolerance) {
      break;
    }

    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - (b - a) / gr;
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + (b - a) / gr;
      fd = f(d);
    }
  }

  // Best point is midpoint of final range
  const bestDiscount = (a + b) / 2;
  return { bestDiscount };
}

export async function GET() {
  try {
    // Read and parse CSV files
    const csvDir = path.join(process.cwd(), 'public', 'CSVs');
    const [salesData, productData, supplierData, categoryData, brandData] = await Promise.all([
      fs.promises.readFile(path.join(csvDir, 'Monthly_sales_forecast.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'supplier_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'product_category_table.csv'), 'utf-8'),
      fs.promises.readFile(path.join(csvDir, 'brand_table.csv'), 'utf-8')
    ].map(p => p.then(data => parse(data, { columns: true }))));

    // Filter for target supplier's products
    const supplierProducts = productData.filter((p: ProductRecord) => p.SupplierKey === TARGET_SUPPLIER);
    const productKeys = new Set(supplierProducts.map((p: ProductRecord) => p.ProductKey));

    // Filter sales data for July only
    const relevantSales = salesData.filter((sale: SalesRecord) => 
      productKeys.has(sale.ProductKey) && 
      sale.TransactionMonth === '7'
    );

    console.log(`Found ${relevantSales.length} sales records for supplier ${TARGET_SUPPLIER}`);

    // Helper function to convert emissions to kg CO2
    const convertToKgCO2 = (value: number, units: string): number => {
      // All values are now in kg CO2, no conversion needed
      console.log(`Converting emissions: ${value} ${units} -> ${value} kg CO2`);
      return value;
    };

    // Calculate emissions per unit for each product
    const totalEmissionsPerUnit: { [key: string]: number } = {};
    supplierProducts.forEach((product: ProductRecord) => {
      const supplier = supplierData.find((s: SupplierRecord) => s.SupplierKey === product.SupplierKey);
      const category = categoryData.find((c: CategoryRecord) => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 && 
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brandData.find((b: BrandRecord) => b.BrandKey === product.BrandKey);

      let totalEmissions = 0;
      if (supplier) {
        const distance = parseFloat(supplier['Distance /mi']);
        const emissionInt = parseFloat(supplier.Est_Emission_Int);
        totalEmissions += convertToKgCO2(distance * emissionInt, supplier.Units);
      }
      if (category) {
        const emissionInt = parseFloat(category.Est_Emission_Int);
        totalEmissions += convertToKgCO2(emissionInt, category.Units);
      }
      if (brand) {
        const emissionInt = parseFloat(brand.Est_Emission_Int);
        totalEmissions += convertToKgCO2(emissionInt, brand.Units);
      }

      totalEmissionsPerUnit[product.ProductKey] = totalEmissions;
      console.log(`Total emissions for product ${product.ProductKey}: ${totalEmissions.toFixed(2)} kg CO2`);
    });

    // Calculate original metrics
    let prevSales = 0;
    let prevProfit = 0;
    let prevEmissions = 0;

    console.log('\nCalculating original metrics...');
    relevantSales.forEach((sale: SalesRecord) => {
      const product = productData.find((p: ProductRecord) => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const originalPrice = parseFloat(sale.PredictedPrice);
      const originalVolume = parseFloat(sale.EstimatedUnitVolume);
      const margin = parseFloat(product.Margin.replace('%', '')) / 100;
      const emissionsPerUnit = totalEmissionsPerUnit[sale.ProductKey] || 0;

      const originalSales = originalPrice * originalVolume;
      const originalGrossProfit = originalSales * margin;
      const originalEmissions = originalVolume * emissionsPerUnit;
      const originalOffsetCost = originalEmissions * CARBON_OFFSET_RATE;
      const originalNetProfit = originalGrossProfit - originalOffsetCost;

      prevSales += originalSales;
      prevProfit += originalNetProfit;
      prevEmissions += originalEmissions;

      console.log(`\nProduct ${sale.ProductKey}:`);
      console.log(`Original Price: ${originalPrice.toFixed(2)}`);
      console.log(`Original Volume: ${originalVolume.toFixed(2)}`);
      console.log(`Original Sales: ${originalSales.toFixed(2)}`);
      console.log(`Original Gross Profit: ${originalGrossProfit.toFixed(2)}`);
      console.log(`Original Emissions: ${originalEmissions.toFixed(2)}`);
      console.log(`Original Offset Cost: ${originalOffsetCost.toFixed(2)}`);
      console.log(`Original Net Profit: ${originalNetProfit.toFixed(2)}`);
    });

    console.log('\nTotal Original Metrics:');
    console.log(`Total Sales: ${prevSales.toFixed(2)}`);
    console.log(`Total Net Profit: ${prevProfit.toFixed(2)}`);
    console.log(`Total Emissions: ${prevEmissions.toFixed(2)}`);

    // Objective function for optimization
    const objectiveFunction = (discount: number) => {
      const { totalNetProfit } = calculateMetricsForDiscount(
        discount,
        relevantSales,
        supplierProducts,
        totalEmissionsPerUnit
      );
      return totalNetProfit;
    };

    // Find optimal discount
    console.log('\nStarting golden section search for optimal discount...');
    const { bestDiscount } = goldenSectionSearch(objectiveFunction);
    console.log(`\nOptimal discount found: ${(bestDiscount * 100).toFixed(2)}%`);

    // Calculate final metrics with optimal discount
    const { totalSales: newSales, totalNetProfit: newProfit } = calculateMetricsForDiscount(
      bestDiscount,
      relevantSales,
      supplierProducts,
      totalEmissionsPerUnit
    );

    // Calculate new emissions
    let newEmissions = 0;
    relevantSales.forEach((sale: SalesRecord) => {
      const product = productData.find((p: ProductRecord) => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const originalPrice = parseFloat(sale.PredictedPrice);
      const originalVolume = parseFloat(sale.EstimatedUnitVolume);
      const elasticity = parseFloat(product.Elasticity);
      const emissionsPerUnit = totalEmissionsPerUnit[sale.ProductKey] || 0;

      const newPrice = originalPrice * (1 - bestDiscount);
      const pctPriceChange = (newPrice - originalPrice) / originalPrice;
      const pctVolumeChange = -elasticity * pctPriceChange;
      const newVolume = Math.max(0, originalVolume * (1 + pctVolumeChange));

      newEmissions += newVolume * emissionsPerUnit;
    });

    // Bonus logic
    const bonusTriggered = newSales > BONUS_THRESHOLD;
    const bonusAmount = bonusTriggered ? BONUS_AMOUNT : 0;
    const newProfitWithBonus = newProfit + bonusAmount;

    // Calculate emissions per RM profit
    const emissionsPerProfitBefore = prevEmissions / prevProfit;
    const emissionsPerProfitAfter = newEmissions / newProfitWithBonus;

    // Calculate percentage changes
    const profitPctIncrease = ((newProfitWithBonus - prevProfit) / prevProfit) * 100;
    const salesPctIncrease = ((newSales - prevSales) / prevSales) * 100;
    const emissionsPctIncrease = ((newEmissions - prevEmissions) / prevEmissions) * 100;

    const response = {
      optimalDiscount: bestDiscount,
      bonusTriggered,
      previousProfit: prevProfit,
      newProfitWithBonus,
      profitPercentageIncrease: profitPctIncrease,
      previousRevenue: prevSales,
      newRevenue: newSales,
      revenuePercentageIncrease: salesPctIncrease,
      previousEmissions: prevEmissions,
      newEmissions,
      emissionsPercentageIncrease: emissionsPctIncrease,
      emissionsPerProfitBefore,
      emissionsPerProfitAfter
    };

    // After calculating final metrics, add verification logging
    console.log('\nFinal Metrics Verification:');
    console.log(`Previous Net Profit: ${prevProfit.toFixed(2)}`);
    console.log(`New Net Profit (before bonus): ${newProfit.toFixed(2)}`);
    console.log(`Bonus Amount: ${bonusAmount.toFixed(2)}`);
    console.log(`New Net Profit (with bonus): ${newProfitWithBonus.toFixed(2)}`);
    console.log(`Profit % Change: ${profitPctIncrease.toFixed(2)}%`);
    console.log(`Previous Revenue: ${prevSales.toFixed(2)}`);
    console.log(`New Revenue: ${newSales.toFixed(2)}`);
    console.log(`Revenue % Change: ${salesPctIncrease.toFixed(2)}%`);
    console.log(`Previous Emissions: ${prevEmissions.toFixed(2)}`);
    console.log(`New Emissions: ${newEmissions.toFixed(2)}`);
    console.log(`Emissions % Change: ${emissionsPctIncrease.toFixed(2)}%`);
    console.log(`Emissions per RM Profit (before): ${emissionsPerProfitBefore.toFixed(4)}`);
    console.log(`Emissions per RM Profit (after): ${emissionsPerProfitAfter.toFixed(4)}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in optimal discount analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process optimal discount analysis' },
      { status: 500 }
    );
  }
}