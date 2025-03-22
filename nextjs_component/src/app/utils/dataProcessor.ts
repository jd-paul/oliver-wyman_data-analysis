import { Product } from '../types/Product';

interface SalesData {
  ProductKey: string;
  Month: string;  // Changed to match CSV format
  EstimatedSales: string;
  EstimatedUnitVolume: string;
}

interface ProductData {
  ProductKey: string;
  Margin: string;
  Elasticity: string;
}

interface EmissionsData {
  BrandKey?: string;
  SupplierKey?: string;
  ProductCategory_Lvl1?: string;
  ProductCategory_Lvl2?: string;
  Est_Emission_Int: number;
}

interface ProductAnalysis extends Product {
  volumeUplift: number;
  percentageVolumeIncrease: number;
  percentageRevenueChange: number;
  marginPercent: number;
  emissionsPerUnit: number;
}

interface AnalysisResult {
  products: ProductAnalysis[];
  companyTotals: {
    totalBaselineSales: number;
    totalProjectedSales: number;
    totalBaselineEmissions: number;
    totalProjectedEmissions: number;
    totalRevenueChange: number;
    totalEmissionsChange: number;
    totalEmissionsOffset: number;
    totalEmissionsOffsetCost: number;
    promotedProductsCount: number;
  };
}

const CARBON_OFFSET_COST_PER_KG = 0.25; // RM per kg CO2
const DISCOUNT_PERCENT = 0.20; // 20% discount
const PROMOTION_PRODUCTS_COUNT = 10;

export function processProductData(
  salesData: SalesData[],
  productData: ProductData[],
  brandEmissions: EmissionsData[],
  supplierEmissions: EmissionsData[],
  categoryEmissions: EmissionsData[]
): AnalysisResult {
  // Group sales data by product
  const salesByProduct = salesData.reduce((acc, curr) => {
    if (!acc[curr.ProductKey]) {
      acc[curr.ProductKey] = {
        totalVolume: 0,
        totalSales: 0,
        averagePrice: 0
      };
    }
    acc[curr.ProductKey].totalVolume += Number(curr.EstimatedUnitVolume) || 0;
    acc[curr.ProductKey].totalSales += Number(curr.EstimatedSales) || 0;
    return acc;
  }, {} as { [key: string]: { totalVolume: number; totalSales: number; averagePrice: number } });

  // Calculate average price for each product
  Object.keys(salesByProduct).forEach(key => {
    salesByProduct[key].averagePrice = 
      salesByProduct[key].totalSales / salesByProduct[key].totalVolume;
  });

  // Calculate emissions per unit for each product
  const emissionsPerUnit = productData.reduce((acc, product) => {
    const brandEmission = brandEmissions.find(b => b.BrandKey === product.ProductKey)?.Est_Emission_Int || 0;
    const supplierEmission = supplierEmissions.find(s => s.SupplierKey === product.ProductKey)?.Est_Emission_Int || 0;
    const categoryEmission = categoryEmissions.find(c => 
      c.ProductCategory_Lvl1 === product.ProductKey || c.ProductCategory_Lvl2 === product.ProductKey
    )?.Est_Emission_Int || 0;
    
    acc[product.ProductKey] = brandEmission + supplierEmission + categoryEmission;
    return acc;
  }, {} as { [key: string]: number });

  // Process all products
  const allProducts = Object.entries(salesByProduct)
    .map(([productKey, sales]) => {
      const productInfo = productData.find(p => p.ProductKey === productKey);
      if (!productInfo || !emissionsPerUnit[productKey]) return null;

      const elasticity = Number(productInfo.Elasticity) || 0;
      const marginPercent = Number(productInfo.Margin.replace('%', '')) / 100;
      const emissionsRate = emissionsPerUnit[productKey];

      return {
        productKey,
        emissions: emissionsRate,
        baselineSales: sales.totalSales,
        baselineVolume: sales.totalVolume,
        averagePrice: sales.averagePrice,
        elasticity,
        marginPercent,
        emissionsPerUnit: emissionsRate
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.emissionsPerUnit - b.emissionsPerUnit); // Sort by emissions per unit

  // Select the 10 products with lowest emissions per unit
  const promotedProducts = allProducts.slice(0, PROMOTION_PRODUCTS_COUNT).map(product => {
    const volumeUplift = Math.pow(1 - DISCOUNT_PERCENT, -product.elasticity);
    const projectedVolume = product.baselineVolume * volumeUplift;
    const projectedPrice = product.averagePrice * (1 - DISCOUNT_PERCENT);
    const projectedRevenue = projectedVolume * projectedPrice;
    
    return {
      productKey: product.productKey,
      emissions: product.emissions,
      baselineSales: product.baselineSales,
      projectedSales: projectedRevenue,
      baselineEmissions: product.baselineVolume * product.emissions,
      projectedEmissions: projectedVolume * product.emissions,
      volumeUplift,
      percentageVolumeIncrease: (volumeUplift - 1) * 100,
      percentageRevenueChange: ((projectedRevenue - product.baselineSales) / product.baselineSales) * 100,
      marginPercent: product.marginPercent,
      emissionsPerUnit: product.emissionsPerUnit
    };
  });

  // Calculate company-wide totals
  const companyTotals = {
    totalBaselineSales: allProducts.reduce((acc, curr) => acc + curr.baselineSales, 0),
    totalProjectedSales: 0,
    totalBaselineEmissions: allProducts.reduce((acc, curr) => acc + (curr.baselineVolume * curr.emissions), 0),
    totalProjectedEmissions: 0,
    totalRevenueChange: 0,
    totalEmissionsChange: 0,
    totalEmissionsOffset: 0,
    totalEmissionsOffsetCost: 0,
    promotedProductsCount: promotedProducts.length
  };

  // Calculate projected totals including non-promoted products
  companyTotals.totalProjectedSales = allProducts.reduce((acc, curr) => {
    const promoted = promotedProducts.find(p => p.productKey === curr.productKey);
    return acc + (promoted?.projectedSales || curr.baselineSales);
  }, 0);

  companyTotals.totalProjectedEmissions = allProducts.reduce((acc, curr) => {
    const promoted = promotedProducts.find(p => p.productKey === curr.productKey);
    if (promoted) {
      return acc + promoted.projectedEmissions;
    }
    return acc + (curr.baselineVolume * curr.emissions);
  }, 0);

  // Calculate percentage changes and offset costs
  companyTotals.totalRevenueChange = 
    ((companyTotals.totalProjectedSales - companyTotals.totalBaselineSales) / 
    companyTotals.totalBaselineSales) * 100;

  companyTotals.totalEmissionsChange = 
    ((companyTotals.totalProjectedEmissions - companyTotals.totalBaselineEmissions) / 
    companyTotals.totalBaselineEmissions) * 100;

  companyTotals.totalEmissionsOffset = companyTotals.totalProjectedEmissions;
  companyTotals.totalEmissionsOffsetCost = 
    companyTotals.totalEmissionsOffset * CARBON_OFFSET_COST_PER_KG;

  return {
    products: promotedProducts,
    companyTotals
  };
}