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
  Volume?: string;
  Sales?: string;
}

interface ProductRecord {
  ProductKey: string;
  ProductCost: string;
  ProductPrice: string;
  Margin: string;
}

export async function GET() {
  try {
    console.log('Processing best sellers data...');

    // Read CSV files
    const salesData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/Monthly_sales_forecast.csv'), 'utf-8');
    const productData = fs.readFileSync(path.join(process.cwd(), 'public/CSVs/product_table.csv'), 'utf-8');

    // Parse CSV data
    const salesRecords: SalesRecord[] = parse(salesData, { columns: true });
    const productRecords: ProductRecord[] = parse(productData, { columns: true });

    // Process sales data for July
    const julySales = salesRecords.filter(record => {
      const month = parseInt(record.TransactionMonth);
      return month === 7;
    });

    console.log(`Found ${julySales.length} sales records for July`);

    // Calculate total sales by product
    const salesByProduct = julySales.reduce((acc, record) => {
      const volume = parseFloat(record.EstimatedUnitVolume || record.Volume || '0');
      const sales = parseFloat(record.EstimatedSales || record.Sales || '0');
      
      if (!acc[record.ProductKey]) {
        acc[record.ProductKey] = {
          totalVolume: 0,
          totalSales: 0,
        };
      }
      
      acc[record.ProductKey].totalVolume += volume;
      acc[record.ProductKey].totalSales += sales;
      
      return acc;
    }, {} as Record<string, { totalVolume: number; totalSales: number; }>);

    // Sort products by sales and select top 10%
    const sortedProducts = Object.entries(salesByProduct)
      .sort(([, a], [, b]) => b.totalSales - a.totalSales);

    const topProductCount = Math.ceil(sortedProducts.length * 0.1); // Top 10%
    const selectedProducts = sortedProducts.slice(0, topProductCount);

    console.log(`Selected ${selectedProducts.length} products (top 10%)`);

    // Calculate metrics for selected products
    const DISCOUNT_PERCENTAGE = 0.10; // 10% discount
    const PRICE_ELASTICITY = 2.0; // Volume increases by 2% for every 1% price decrease

    const processedProducts = selectedProducts.map(([productKey, data], index) => {
      const productInfo = productRecords.find(p => p.ProductKey === productKey);
      const margin = productInfo ? parseFloat(productInfo.Margin) : 0.2; // Default 20% margin if not found
      
      const baselineSales = data.totalSales;
      const volumeUplift = data.totalVolume * (DISCOUNT_PERCENTAGE * PRICE_ELASTICITY);
      const projectedSales = (baselineSales * (1 - DISCOUNT_PERCENTAGE)) * (1 + (DISCOUNT_PERCENTAGE * PRICE_ELASTICITY));

      return {
        productKey,
        rank: index + 1,
        baselineSales,
        projectedSales,
        volumeUplift,
        percentageVolumeIncrease: (volumeUplift / data.totalVolume) * 100,
        percentageRevenueChange: ((projectedSales - baselineSales) / baselineSales) * 100,
        marginPercent: margin
      };
    });

    // Calculate totals
    const companyBaselineRevenue = sortedProducts.reduce((sum, [, data]) => sum + data.totalSales, 0);
    const promotedProductsBaselineRevenue = processedProducts.reduce((sum, p) => sum + p.baselineSales, 0);
    const promotedProductsProjectedRevenue = processedProducts.reduce((sum, p) => sum + p.projectedSales, 0);
    const companyProjectedRevenue = companyBaselineRevenue - promotedProductsBaselineRevenue + promotedProductsProjectedRevenue;

    const response = {
      products: processedProducts,
      totals: {
        companyBaselineRevenue,
        companyProjectedRevenue,
        companyRevenueChange: ((companyProjectedRevenue - companyBaselineRevenue) / companyBaselineRevenue) * 100,
        promotedProductsBaselineRevenue,
        promotedProductsProjectedRevenue,
        promotedProductsRevenueChange: ((promotedProductsProjectedRevenue - promotedProductsBaselineRevenue) / promotedProductsBaselineRevenue) * 100,
        promotedProductsShareOfRevenue: (promotedProductsBaselineRevenue / companyBaselineRevenue) * 100
      }
    };

    console.log('Best sellers data processing complete');
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing best sellers data:', error);
    return NextResponse.json(
      { error: 'Failed to process best sellers data' },
      { status: 500 }
    );
  }
} 