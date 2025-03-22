import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function loadCSVData() {
  const csvDir = path.join(process.cwd(), 'CSVs');
  
  // Read CSV files
  const salesData = await fs.promises.readFile(
    path.join(csvDir, 'Monthly_sales_forecast.csv'),
    'utf-8'
  );
  const productData = await fs.promises.readFile(
    path.join(csvDir, 'product_table.csv'),
    'utf-8'
  );
  
  // Parse CSV data
  const salesRecords = parse(salesData, {
    columns: true,
    skip_empty_lines: true
  });
  
  const productRecords = parse(productData, {
    columns: true,
    skip_empty_lines: true
  });

  // For this example, we'll use a simple emissions mapping
  // In a real application, this would come from actual emissions data
  const emissionsPerUnit = productRecords.reduce((acc: { [key: string]: number }, product: any) => {
    // Generate a random emission value between 0.5 and 5 for demonstration
    acc[product.ProductKey] = 0.5 + Math.random() * 4.5;
    return acc;
  }, {});

  return {
    salesData: salesRecords,
    productData: productRecords,
    emissionsPerUnit
  };
} 