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

interface ProductEmissions {
  productKey: string;
  totalEmissions: number;
  sales: number;
  emissionsPerSale: number;
}

export async function GET() {
  try {
    console.log('Starting emissions analysis...');

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

    // Calculate emissions and sales for each product
    const productEmissions: ProductEmissions[] = [];
    
    julySales.forEach(sale => {
      const product = products.find(p => p.ProductKey === sale.ProductKey);
      if (!product) return;

      const category = categories.find(c => 
        c.ProductCategory_Lvl1 === product.ProductCategory_Lvl1 &&
        c.ProductCategory_Lvl2 === product.ProductCategory_Lvl2
      );
      const brand = brands.find(b => b.BrandKey === product.BrandKey);
      const supplier = suppliers.find(s => s.SupplierKey === product.SupplierKey);

      let totalEmissions = 0;
      if (category) totalEmissions += parseFloat(category.Est_Emission_Int);
      if (brand) totalEmissions += parseFloat(brand.Est_Emission_Int);
      if (supplier) {
        const distance = parseFloat(supplier['Distance /mi']);
        const emissionInt = parseFloat(supplier.Est_Emission_Int);
        totalEmissions += distance * emissionInt;
      }

      const sales = parseFloat(sale.EstimatedSales);
      const volume = parseFloat(sale.EstimatedUnitVolume);
      
      productEmissions.push({
        productKey: sale.ProductKey,
        totalEmissions: totalEmissions * volume,
        sales,
        emissionsPerSale: totalEmissions
      });
    });

    // Sort products by emissions per sale (ascending) and get bottom 10%
    productEmissions.sort((a, b) => a.emissionsPerSale - b.emissionsPerSale);
    const lowEmissionCount = Math.ceil(productEmissions.length * 0.1);
    const lowEmissionProducts = productEmissions.slice(0, lowEmissionCount);

    console.log(`Selected ${lowEmissionProducts.length} low-emission products`);

    // Calculate baseline metrics
    let baselineTotalSales = 0;
    let baselineTotalProfit = 0;
    let baselineTotalEmissions = 0;

    lowEmissionProducts.forEach(product => {
      const productData = products.find(p => p.ProductKey === product.productKey);
      if (!productData) return;

      const margin = parseFloat(productData.Margin);
      const profit = product.sales * margin;

      baselineTotalSales += product.sales;
      baselineTotalProfit += profit;
      baselineTotalEmissions += product.totalEmissions;
    });

    // Calculate metrics with 10% discount
    const elasticityEffect = 1.5; // Assuming 1.5x increase in sales for 10% discount
    const newTotalSales = baselineTotalSales * elasticityEffect;
    const newTotalProfit = newTotalSales * 0.9 * (baselineTotalProfit / baselineTotalSales); // Adjust for discount
    const newTotalEmissions = baselineTotalEmissions * elasticityEffect;

    // Calculate offset costs (assuming RM 0.10 per kg CO2)
    const offsetCostPerKg = 0.10;
    const baselineOffsetCost = baselineTotalEmissions * offsetCostPerKg;
    const newOffsetCost = newTotalEmissions * offsetCostPerKg;

    const response = {
      salesAndCosts: {
        baselineTotalSales,
        newTotalSales,
        incrementalSales: newTotalSales - baselineTotalSales,
        baselineTotalProfit,
        newTotalProfit,
        incrementalProfit: newTotalProfit - baselineTotalProfit
      },
      emissionsAndOffset: {
        baselineTotalEmissions,
        newTotalEmissions,
        incrementalEmissions: newTotalEmissions - baselineTotalEmissions,
        baselineOffsetCost,
        newOffsetCost,
        incrementalOffsetCost: newOffsetCost - baselineOffsetCost
      }
    };

    console.log('Emissions analysis completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in emissions analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process emissions analysis' },
      { status: 500 }
    );
  }
} 