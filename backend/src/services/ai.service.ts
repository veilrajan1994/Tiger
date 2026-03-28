import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedSearchFilters {
  sku?: string;
  productName?: string;
  storeId?: string;
  storeName?: string;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface DashboardInsight {
  summary: string;
  highlights: string[];
  recommendations: string[];
}

// ─── Lazy Gemini client ──────────────────────────────────────────────────────

let geminiModel: any = null;

const getGeminiModel = () => {
  if (!geminiModel) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.');
    }
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });
    } catch (e) {
      throw new Error('Google Generative AI package is not installed. Run: npm install @google/generative-ai');
    }
  }
  return geminiModel;
};

// ─── Helper: strip markdown fences from AI response ─────────────────────────

const cleanJsonResponse = (text: string): string => {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
};

// ─── Natural Language Search ─────────────────────────────────────────────────

export const parseNaturalLanguageQuery = async (
  query: string,
  availableStores: Array<{ id: string; storeName: string }>
): Promise<ParsedSearchFilters> => {
  const model = getGeminiModel();
  const storeList = availableStores.map((s) => `"${s.storeName}" (id: ${s.id})`).join(', ');
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are a search query parser for a retail pricing system. Convert natural language queries into structured JSON filters.

Available stores: ${storeList}
Today's date: ${today}

Return a JSON object with ONLY these optional fields (omit fields that aren't mentioned):
- sku: string (SKU code if mentioned)
- productName: string (product name or keyword)
- storeId: string (the store UUID if a store is mentioned — match by name)
- dateFrom: string (ISO date, e.g. "2024-01-01")
- dateTo: string (ISO date)
- minPrice: number
- maxPrice: number
- sortBy: "date" | "price" | "sku" | "productName"
- sortOrder: "asc" | "desc"

For relative dates like "last week", "this month", "past 30 days", calculate from today.
If the user says "expensive" or "high price", sort by price desc.
If the user says "cheap" or "low price", sort by price asc.
If the user says "recent" or "latest", sort by date desc.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser query: ${query}` }] }],
    generationConfig: { temperature: 0 },
  });

  const content = result.response.text();
  if (!content) {
    throw new Error('No response from AI');
  }

  const parsed = JSON.parse(cleanJsonResponse(content)) as ParsedSearchFilters;
  logger.info(`AI parsed query: "${query}" → ${JSON.stringify(parsed)}`);
  return parsed;
};

// ─── Dashboard Insights ──────────────────────────────────────────────────────

export const generateDashboardInsights = async (
  userRole: string,
  userStoreId?: string
): Promise<DashboardInsight> => {
  const model = getGeminiModel();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const storeFilter = userRole === 'STORE_MANAGER' && userStoreId
    ? { storeId: userStoreId }
    : {};

  const [
    totalRecords,
    recentRecords,
    priceStats,
    storeBreakdown,
    recentUploads,
    topProducts
  ] = await Promise.all([
    prisma.pricingRecord.count({ where: storeFilter }),
    prisma.pricingRecord.count({
      where: { ...storeFilter, updatedAt: { gte: weekAgo } }
    }),
    prisma.pricingRecord.aggregate({
      where: storeFilter,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true }
    }),
    userRole === 'ADMIN'
      ? prisma.pricingRecord.groupBy({
          by: ['storeId'],
          _count: { id: true },
          _avg: { price: true }
        })
      : Promise.resolve([]),
    prisma.uploadHistory.findMany({
      where: {
        startedAt: { gte: monthAgo },
        ...(userRole === 'STORE_MANAGER' ? { uploadedBy: userStoreId } : {})
      },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { status: true, totalRecords: true, successCount: true, errorCount: true }
    }),
    prisma.pricingRecord.groupBy({
      by: ['productName'],
      where: storeFilter,
      _count: { id: true },
      _avg: { price: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })
  ]);

  let storeNames: Record<string, string> = {};
  if (Array.isArray(storeBreakdown) && storeBreakdown.length > 0) {
    const stores = await prisma.store.findMany({
      where: { id: { in: storeBreakdown.map((s: any) => s.storeId) } },
      select: { id: true, storeName: true }
    });
    storeNames = Object.fromEntries(stores.map((s) => [s.id, s.storeName]));
  }

  const statsContext = {
    totalRecords,
    recordsUpdatedThisWeek: recentRecords,
    avgPrice: priceStats._avg.price?.toFixed(2),
    minPrice: priceStats._min.price?.toFixed(2),
    maxPrice: priceStats._max.price?.toFixed(2),
    storeBreakdown: Array.isArray(storeBreakdown)
      ? storeBreakdown.map((s: any) => ({
          store: storeNames[s.storeId] || s.storeId,
          count: s._count.id,
          avgPrice: s._avg.price?.toFixed(2)
        }))
      : [],
    recentUploads: recentUploads.map((u) => ({
      status: u.status,
      total: u.totalRecords,
      success: u.successCount,
      errors: u.errorCount
    })),
    topProducts: topProducts.map((p) => ({
      name: p.productName,
      count: p._count.id,
      avgPrice: p._avg.price?.toFixed(2)
    }))
  };

  const systemPrompt = `You are a retail pricing analyst. Given pricing data statistics, generate actionable insights.

Return JSON with:
- summary: A 2-3 sentence overview of the current pricing state
- highlights: Array of 3-4 key observations (short, specific, data-driven)
- recommendations: Array of 2-3 actionable suggestions

Keep it concise and business-focused. Use actual numbers from the data.
The user role is: ${userRole}`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nHere are the current pricing statistics:\n${JSON.stringify(statsContext, null, 2)}` }] }],
    generationConfig: { temperature: 0.7 },
  });

  const content = result.response.text();
  if (!content) {
    throw new Error('No response from AI');
  }

  return JSON.parse(cleanJsonResponse(content)) as DashboardInsight;
};

// ─── Types for new features ──────────────────────────────────────────────────

export interface CSVValidationResult {
  isValid: boolean;
  totalRows: number;
  issues: Array<{
    row: number;
    column: string;
    issue: string;
    severity: 'error' | 'warning';
    suggestion?: string;
  }>;
  summary: string;
}

export interface GeneratedReport {
  title: string;
  period: string;
  generatedAt: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  keyMetrics: Array<{ label: string; value: string }>;
  recommendations: string[];
}

// ─── 1. AI-Powered CSV Validation ────────────────────────────────────────────

export const validateCSVWithAI = async (
  rows: Array<Record<string, string>>,
  existingStoreIds: string[]
): Promise<CSVValidationResult> => {
  const model = getGeminiModel();

  const sampleRows = rows.slice(0, 50);
  const totalRows = rows.length;

  const prompt = `You are a data quality analyst for a retail pricing system. Analyze this CSV data for quality issues.

Valid Store IDs in the system: ${JSON.stringify(existingStoreIds)}

CSV Data (first ${sampleRows.length} of ${totalRows} rows):
${JSON.stringify(sampleRows, null, 2)}

Required columns: "Store ID", "SKU", "Product Name", "Price", "Date"

Check for:
1. Missing or empty required fields
2. Invalid Store IDs (not in the valid list)
3. Invalid prices (negative, zero, unreasonably high like >100000)
4. Invalid date formats (should be YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY)
5. Duplicate SKU+Store+Date combinations
6. Suspicious data patterns (e.g. all same price, product names that look like test data)
7. Price outliers compared to other rows

Return JSON:
{
  "isValid": boolean (true if no errors, warnings are ok),
  "totalRows": ${totalRows},
  "issues": [{ "row": number, "column": string, "issue": string, "severity": "error"|"warning", "suggestion": string }],
  "summary": "Brief 1-2 sentence summary of data quality"
}

Limit issues to the top 20 most important ones.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0 },
  });

  const content = result.response.text();
  if (!content) throw new Error('No response from AI');

  return JSON.parse(cleanJsonResponse(content)) as CSVValidationResult;
};

// ─── 2. Natural Language Report Generation ───────────────────────────────────

export const generateReport = async (
  query: string,
  userRole: string,
  userStoreId?: string
): Promise<GeneratedReport> => {
  const model = getGeminiModel();

  const storeFilter = userRole === 'STORE_MANAGER' && userStoreId
    ? { storeId: userStoreId }
    : {};

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Gather comprehensive data
  const [
    totalRecords,
    recentRecords,
    priceStats,
    storeBreakdown,
    topProducts,
    recentUploads,
    stores
  ] = await Promise.all([
    prisma.pricingRecord.count({ where: storeFilter }),
    prisma.pricingRecord.count({ where: { ...storeFilter, updatedAt: { gte: weekAgo } } }),
    prisma.pricingRecord.aggregate({
      where: storeFilter,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true }
    }),
    prisma.pricingRecord.groupBy({
      by: ['storeId'],
      where: storeFilter,
      _count: { id: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true }
    }),
    prisma.pricingRecord.groupBy({
      by: ['productName', 'sku'],
      where: storeFilter,
      _count: { id: true },
      _avg: { price: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20
    }),
    prisma.uploadHistory.findMany({
      where: { startedAt: { gte: monthAgo } },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { status: true, totalRecords: true, successCount: true, errorCount: true, startedAt: true, fileName: true }
    }),
    prisma.store.findMany({ select: { id: true, storeName: true, country: true } })
  ]);

  const storeNames = Object.fromEntries(stores.map(s => [s.id, s.storeName]));

  const dataContext = {
    totalRecords,
    recordsUpdatedThisWeek: recentRecords,
    priceStats: {
      avg: priceStats._avg.price?.toFixed(2),
      min: priceStats._min.price?.toFixed(2),
      max: priceStats._max.price?.toFixed(2)
    },
    storeBreakdown: storeBreakdown.map((s: any) => ({
      store: storeNames[s.storeId] || s.storeId,
      count: s._count.id,
      avgPrice: s._avg.price?.toFixed(2),
      minPrice: s._min.price?.toFixed(2),
      maxPrice: s._max.price?.toFixed(2)
    })),
    topProducts: topProducts.map(p => ({
      name: p.productName,
      sku: p.sku,
      count: p._count.id,
      avgPrice: p._avg.price?.toFixed(2)
    })),
    recentUploads: recentUploads.map(u => ({
      fileName: u.fileName,
      status: u.status,
      total: u.totalRecords,
      success: u.successCount,
      errors: u.errorCount,
      date: u.startedAt.toISOString().split('T')[0]
    })),
    stores: stores.map(s => ({ name: s.storeName, country: s.country }))
  };

  const prompt = `You are a retail pricing report generator. Generate a professional report based on the user's request and the available data.

User request: "${query}"
User role: ${userRole}
Today's date: ${now.toISOString().split('T')[0]}

Available data:
${JSON.stringify(dataContext, null, 2)}

Generate a comprehensive report. Return JSON:
{
  "title": "Report title based on user request",
  "period": "Time period covered",
  "generatedAt": "${now.toISOString()}",
  "sections": [
    { "heading": "Section title", "content": "Detailed paragraph with specific numbers from the data" }
  ],
  "keyMetrics": [
    { "label": "Metric name", "value": "Metric value with units" }
  ],
  "recommendations": ["Actionable recommendation based on data"]
}

Include 3-5 sections, 4-6 key metrics, and 2-4 recommendations. Use actual numbers from the data. Be specific and business-focused.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5 },
  });

  const content = result.response.text();
  if (!content) throw new Error('No response from AI');

  return JSON.parse(cleanJsonResponse(content)) as GeneratedReport;
};
