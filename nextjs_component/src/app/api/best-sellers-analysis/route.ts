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

export async function GET() {
  try {
    console.log('Starting best sellers analysis...');

    // Read CSV files
    const salesData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/Monthly_sales_forecast.csv'), 'utf-8');
    const productData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/product_table.csv'), 'utf-8');
    const supplierData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/supplier_table.csv'), 'utf-8');
    const categoryData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/product_category_table.csv'), 'utf-8');
    const brandData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/brand_table.csv'), 'utf-8');

    // Parse CSV files
    const sales: SalesRecord[] = parse(salesData, { columns: true });
    const products: ProductRecord[] = parse(productData, { columns: true });
    const suppliers: SupplierRecord[] = parse(supplierData, { columns: true });
    const categories: CategoryRecord[] = parse(categoryData, { columns: true });
    const brands: BrandRecord[] = parse(brandData, { columns: true });

    console.log('CSV files parsed successfully');

    // Filter for July sales
    const julySales = sales.filter(record => record.TransactionMonth === '7');
    console.log(`Found ${julySales.length} July sales records`);

    // Calculate total sales by product
    const productSales = new Map<string, number>();
    julySales.forEach(record => {
      const sales = parseFloat(record.EstimatedSales);
      productSales.set(record.ProductKey, (productSales.get(record.ProductKey) || 0) + sales);
    });

    // Sort products by sales and get top 10%
    const sortedProducts = Array.from(productSales.entries())
      .sort(([, a], [, b]) => b - a);
    const topProductCount = Math.ceil(sortedProducts.length * 0.1);
    const bestSellers = sortedProducts.slice(0, topProductCount);

    console.log(`Selected ${bestSellers.length} best selling products`);

    // Calculate baseline metrics
    let baselineRevenue = 0;
    let baselineTotalProfit = 0;
    let baselineTotalEmissions = 0;

    bestSellers.forEach(([productKey, sales]) => {
      const product = products.find(p => p.ProductKey === productKey);
      if (!product) return;

      const julyRecord = julySales.find(s => s.ProductKey === productKey);
      if (!julyRecord) return;

      const unitVolume = parseFloat(julyRecord.EstimatedUnitVolume);
      const unitPrice = parseFloat(julyRecord.PredictedPrice);
      const margin = parseFloat(product.Margin);
      
      // Calculate baseline metrics
      const baselineUnitRevenue = unitPrice * unitVolume;
      const baselineUnitProfit = baselineUnitRevenue * margin;

      // Calculate emissions
      const category = categories.find(c => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 &&
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brands.find(b => b.BrandKey === product.BrandKey);
      const supplier = suppliers.find(s => s.SupplierKey === product.SupplierKey);

      let emissionsPerUnit = 0;
      if (category) emissionsPerUnit += parseFloat(category.Est_Emission_Int);
      if (brand) emissionsPerUnit += parseFloat(brand.Est_Emission_Int);
      if (supplier) {
        const distance = parseFloat(supplier['Distance /mi']);
        const emissionInt = parseFloat(supplier.Est_Emission_Int);
        emissionsPerUnit += distance * emissionInt;
      }

      const baselineEmissions = emissionsPerUnit * unitVolume;

      baselineRevenue += baselineUnitRevenue;
      baselineTotalProfit += baselineUnitProfit;
      baselineTotalEmissions += baselineEmissions;
    });

    // Calculate metrics with 10% discount
    const discountPercent = 0.10; // 10% discount
    let newRevenue = 0;
    let newTotalProfit = 0;
    let newTotalEmissions = 0;

    bestSellers.forEach(([productKey, sales]) => {
      const product = products.find(p => p.ProductKey === productKey);
      if (!product) return;

      const julyRecord = julySales.find(s => s.ProductKey === productKey);
      if (!julyRecord) return;

      const unitVolume = parseFloat(julyRecord.EstimatedUnitVolume);
      const unitPrice = parseFloat(julyRecord.PredictedPrice);
      const margin = parseFloat(product.Margin);
      const elasticity = parseFloat(product.Elasticity);
      
      // Calculate new volume based on elasticity
      const volumeIncrease = elasticity * discountPercent;
      const newVolume = unitVolume * (1 + volumeIncrease);
      
      // Calculate new price and revenue
      const newPrice = unitPrice * (1 - discountPercent);
      const newUnitRevenue = newPrice * newVolume;
      const newUnitProfit = newUnitRevenue * margin;

      // Calculate emissions
      const category = categories.find(c => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 &&
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brands.find(b => b.BrandKey === product.BrandKey);
      const supplier = suppliers.find(s => s.SupplierKey === product.SupplierKey);

      let emissionsPerUnit = 0;
      if (category) emissionsPerUnit += parseFloat(category.Est_Emission_Int);
      if (brand) emissionsPerUnit += parseFloat(brand.Est_Emission_Int);
      if (supplier) {
        const distance = parseFloat(supplier['Distance /mi']);
        const emissionInt = parseFloat(supplier.Est_Emission_Int);
        emissionsPerUnit += distance * emissionInt;
      }

      const newEmissions = emissionsPerUnit * newVolume;

      newRevenue += newUnitRevenue;
      newTotalProfit += newUnitProfit;
      newTotalEmissions += newEmissions;
    });

    // Calculate offset costs (assuming RM 0.10 per kg CO2)
    const offsetCostPerKg = 0.10;
    const baselineOffsetCost = baselineTotalEmissions * offsetCostPerKg;
    const newOffsetCost = newTotalEmissions * offsetCostPerKg;

    const response = {
      emissionsAndOffset: {
        baselineTotalEmissions,
        newTotalEmissions,
        incrementalEmissions: newTotalEmissions - baselineTotalEmissions,
        baselineOffsetCost,
        newOffsetCost,
        incrementalOffsetCost: newOffsetCost - baselineOffsetCost
      }
    };

    console.log('Best sellers analysis completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in best sellers analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process best sellers analysis' },
      { status: 500 }
    );
  }
} 