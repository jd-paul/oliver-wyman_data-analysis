import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface SalesRecord {
  ProductKey: string;
  TransactionMonth: string;  // Changed from Month to TransactionMonth
  EstimatedSales: string;
  EstimatedUnitVolume: string;
  PredictedPrice: string;
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

export async function GET() {
  try {
    // Update path to point to public/CSVs
    const csvDir = path.join(process.cwd(), 'public', 'CSVs');
    console.log('Reading CSV files from:', csvDir);
    
    // Read CSV files
    const salesData = await fs.promises.readFile(
      path.join(csvDir, 'Monthly_sales_forecast.csv'),
      'utf-8'
    );
    console.log('Successfully read sales data');
    
    const productData = await fs.promises.readFile(
      path.join(csvDir, 'product_table.csv'),
      'utf-8'
    );
    console.log('Successfully read product data');
    
    const supplierData = await fs.promises.readFile(
      path.join(csvDir, 'supplier_table.csv'),
      'utf-8'
    );
    console.log('Successfully read supplier data');
    
    const categoryData = await fs.promises.readFile(
      path.join(csvDir, 'product_category_table.csv'),
      'utf-8'
    );
    console.log('Successfully read category data');
    
    const brandData = await fs.promises.readFile(
      path.join(csvDir, 'brand_table.csv'),
      'utf-8'
    );
    console.log('Successfully read brand data');

    // Parse CSV data
    console.log('\n=== Parsing CSV Data ===');
    
    console.log('\nParsing sales data...');
    const salesRecords: SalesRecord[] = parse(salesData, {
      columns: true,
      skip_empty_lines: true
    });
    console.log('Raw sales data sample:', salesData.split('\n').slice(0, 3));
    console.log('Parsed sales records:', salesRecords.length);
    
    console.log('\nParsing product data...');
    const productRecords: ProductRecord[] = parse(productData, {
      columns: true,
      skip_empty_lines: true
    });
    console.log('Raw product data sample:', productData.split('\n').slice(0, 3));
    console.log('Parsed product records:', productRecords.length);

    console.log('\nParsing supplier data...');
    console.log('Raw supplier data first few lines:', supplierData.split('\n').slice(0, 5));
    const supplierRecords: SupplierRecord[] = parse(supplierData.trim(), {
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
      trim: true
    });
    console.log('Parsed supplier records:', supplierRecords.length);
    if (supplierRecords.length > 0) {
      console.log('First supplier record:', supplierRecords[0]);
      console.log('All supplier keys:', supplierRecords.map(s => s.SupplierKey));
    } else {
      console.log('No supplier records were parsed!');
    }

    console.log('\nParsing category data...');
    const categoryRecords: CategoryRecord[] = parse(categoryData, {
      columns: true,
      skip_empty_lines: true
    });
    console.log('Parsed category records:', categoryRecords.length);

    console.log('\nParsing brand data...');
    const brandRecords: BrandRecord[] = parse(brandData, {
      columns: true,
      skip_empty_lines: true
    });
    console.log('Parsed brand records:', brandRecords.length);
    
    console.log('\n=== Finished Parsing CSV Data ===\n');

    // Process sales data to get total volume and sales by product
    const salesByProduct = salesRecords.reduce((acc, record) => {
      // Only consider July sales (month 7)
      const month = parseInt(record.TransactionMonth);
      if (isNaN(month) || month !== 7) {
        return acc;
      }

      const productKey = record.ProductKey;
      if (!acc[productKey]) {
        acc[productKey] = {
          totalVolume: 0,
          totalSales: 0
        };
      }
      
      // Parse and add the sales data
      const volume = Number(record.EstimatedUnitVolume) || 0;
      const sales = Number(record.EstimatedSales) || 0;
      
      acc[productKey].totalVolume += volume;
      acc[productKey].totalSales += sales;
      
      return acc;
    }, {} as { [key: string]: { totalVolume: number; totalSales: number } });

    console.log('\nProcessed July (month 7) sales data:');
    console.log('Number of products with July sales:', Object.keys(salesByProduct).length);
    if (Object.keys(salesByProduct).length === 0) {
      console.error('No July sales data found in records');
      throw new Error('No July sales data found');
    }

    // Log some sample data to verify
    const sampleProducts = Object.entries(salesByProduct).slice(0, 3);
    console.log('\nSample July sales data:');
    sampleProducts.forEach(([key, data]) => {
      console.log(`Product ${key}: Volume=${data.totalVolume}, Sales=${data.totalSales}`);
    });

    // Process all products first to get total July revenue
    const allProducts = Object.entries(salesByProduct);
    
    // Calculate total July company revenue
    const totalCompanyRevenue = allProducts.reduce((acc, [_, sales]) => acc + sales.totalSales, 0);
    console.log('Total July company revenue:', totalCompanyRevenue);

    // Helper function to convert emissions to kg CO2
    const convertToKgCO2 = (value: number, units: string): number => {
      if (units.toLowerCase().includes('g')) {
        return value / 1000; // Convert g to kg
      }
      return value;
    };

    // Process products with emissions calculation
    const productsWithEmissions = allProducts
      .map(([productKey, sales]) => {
        console.log(`\nProcessing product ${productKey}...`);
        
        const productInfo = productRecords.find(p => p.ProductKey === productKey);
        if (!productInfo) {
          console.log(`- No product info found for ${productKey}`);
          return null;
        }
        console.log('- Found product info');

        // Clean up supplier key and perform lookup
        const supplierKey = productInfo.SupplierKey?.trim() || '';
        console.log(`- Looking for supplier with key "${supplierKey}"`);
        const supplierInfo = supplierRecords.find(s => (s?.SupplierKey || '').trim() === supplierKey);
        
        if (!supplierInfo) {
          console.log(`- No supplier info found for supplier ${supplierKey}`);
          console.log('- Available supplier keys:', supplierRecords.map(s => s?.SupplierKey || '').join(', '));
          return null;
        }
        console.log('- Found supplier info');

        // Calculate supplier emissions (required)
        const emissionIntensity = Number(supplierInfo.Est_Emission_Int) || 0;
        const distance = Number(supplierInfo['Distance /mi']) || 0;
        const supplierEmissions = convertToKgCO2(emissionIntensity, supplierInfo.Units) * distance * sales.totalVolume;
        console.log(`- Supplier emissions: ${supplierEmissions.toFixed(2)} kg CO2`);

        // Calculate category emissions (optional)
        let categoryEmissions = 0;
        const categoryInfo = categoryRecords.find(c => 
          c.ProductCategory_Lvl1 === productInfo.ProductCategory_Lvl1 && 
          c.ProductCategory_Lvl2 === productInfo.ProductCategory_Lvl2
        );
        if (categoryInfo) {
          console.log('- Found category info');
          const categoryEmissionInt = Number(categoryInfo.Est_Emission_Int) || 0;
          categoryEmissions = convertToKgCO2(categoryEmissionInt, categoryInfo.Units) * sales.totalVolume;
          console.log(`- Category emissions: ${categoryEmissions.toFixed(2)} kg CO2`);
        } else {
          console.log(`- No category info found for ${productInfo.ProductCategory_Lvl1}/${productInfo.ProductCategory_Lvl2}`);
        }

        // Calculate brand emissions (optional)
        let brandEmissions = 0;
        const brandInfo = brandRecords.find(b => b.BrandKey === productInfo.BrandKey);
        if (brandInfo) {
          console.log('- Found brand info');
          const brandEmissionInt = Number(brandInfo.Est_Emission_Int) || 0;
          brandEmissions = convertToKgCO2(brandEmissionInt, brandInfo.Units) * sales.totalVolume;
          console.log(`- Brand emissions: ${brandEmissions.toFixed(2)} kg CO2`);
        } else {
          console.log(`- No brand info found for ${productInfo.BrandKey}`);
        }

        // Calculate total emissions from all sources
        const totalEmissions = supplierEmissions + categoryEmissions + brandEmissions;
        console.log(`- Total emissions: ${totalEmissions.toFixed(2)} kg CO2`);

        const elasticity = Number(productInfo.Elasticity) || 0;
        const marginPercent = Number(productInfo.Margin.replace('%', '')) / 100;
        const discountPercent = 0.20;

        const volumeUplift = Math.pow(1 - discountPercent, -elasticity);
        const percentageVolumeIncrease = (volumeUplift - 1) * 100;

        const baselineSales = sales.totalSales;
        const projectedSales = sales.totalVolume * volumeUplift * (sales.totalSales / sales.totalVolume) * (1 - discountPercent);
        const percentageRevenueChange = ((projectedSales - baselineSales) / baselineSales) * 100;

        console.log(`- Baseline sales: ${baselineSales.toFixed(2)}`);
        console.log(`- Projected sales: ${projectedSales.toFixed(2)}`);
        console.log(`- Volume increase: ${percentageVolumeIncrease.toFixed(2)}%`);
        console.log(`- Revenue change: ${percentageRevenueChange.toFixed(2)}%`);

        return {
          productKey,
          baselineSales,
          projectedSales,
          volumeUplift,
          percentageVolumeIncrease,
          percentageRevenueChange,
          marginPercent,
          totalEmissions,
          supplierEmissions,
          categoryEmissions,
          brandEmissions
        };
      })
      .filter((p): p is ProcessedProduct => p !== null);

    // Sort by emissions (lowest first) and take top 10
    const processedProducts = productsWithEmissions
      .sort((a, b) => a.totalEmissions - b.totalEmissions)
      .slice(0, 10);

    console.log(`\nProcessed ${productsWithEmissions.length} products in total`);
    console.log(`Selected ${processedProducts.length} products with lowest emissions`);

    if (processedProducts.length === 0) {
      console.error('No products were processed successfully');
      throw new Error('No products could be processed');
    }

    // Log the 10 selected products with their emissions breakdown
    console.log('\nSelected products with lowest total emissions:');
    processedProducts.forEach(p => {
      console.log(`\nProduct ${p.productKey}:`);
      console.log(`Total Emissions: ${p.totalEmissions.toFixed(2)} kg CO2`);
      console.log(`- Supplier Emissions: ${p.supplierEmissions.toFixed(2)} kg CO2`);
      console.log(`- Category Emissions: ${p.categoryEmissions.toFixed(2)} kg CO2`);
      console.log(`- Brand Emissions: ${p.brandEmissions.toFixed(2)} kg CO2`);
      console.log(`Baseline Sales: ${p.baselineSales.toFixed(2)}`);
      console.log(`Projected Sales: ${p.projectedSales.toFixed(2)}`);
    });

    // Calculate totals for promoted products
    const promotedProductsBaseline = processedProducts.reduce((acc, curr) => acc + curr.baselineSales, 0);
    const promotedProductsProjected = processedProducts.reduce((acc, curr) => acc + curr.projectedSales, 0);

    // Calculate new company revenue (including promotion impact)
    const newCompanyRevenue = totalCompanyRevenue - promotedProductsBaseline + promotedProductsProjected;

    // Prepare the response object
    const response = {
      products: processedProducts,
      totals: {
        companyBaselineRevenue: totalCompanyRevenue,
        companyProjectedRevenue: newCompanyRevenue,
        companyRevenueChange: ((newCompanyRevenue - totalCompanyRevenue) / totalCompanyRevenue) * 100,
        promotedProductsBaselineRevenue: promotedProductsBaseline,
        promotedProductsProjectedRevenue: promotedProductsProjected,
        promotedProductsRevenueChange: ((promotedProductsProjected - promotedProductsBaseline) / promotedProductsBaseline) * 100,
        promotedProductsShareOfRevenue: (promotedProductsBaseline / totalCompanyRevenue) * 100
      }
    };

    // Log and return the response
    console.log('\nAPI Response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing CSV data:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV data' },
      { status: 500 }
    );
  }
} 