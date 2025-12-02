
import { createClient } from '@supabase/supabase-js';

// ⚠️ هام: قم باستبدال القيم أدناه بالمفاتيح الخاصة بمشروعك من إعدادات Supabase
// Settings -> API

// 1. ضع رابط المشروع هنا (Project URL)
const SUPABASE_URL = 'https://aixyazdvdxednmylyjab.supabase.co';

// 2. ضع المفتاح العام هنا (anon / public key)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpeHlhemR2ZHhlZG5teWx5amFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2OTQwNDMsImV4cCI6MjA4MDI3MDA0M30.6CAsDBTRQZcb4J4BiSu59M6oWA1M8r9K0XmfrtMtV-c';

// التحقق من صحة الرابط لمنع توقف التطبيق
const isValidUrl = (url: string) => {
  try {
    return url.startsWith('https://');
  } catch (e) {
    return false;
  }
};

export const isConfigured = isValidUrl(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR_SUPABASE');

// إنشاء العميل أو كائن وهمي لمنع الانهيار
const client = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (() => {
      console.warn("Supabase is not configured. Please update supabaseClient.ts with your credentials.");
      
      // Mock Chainable Object to prevent crashes
      const mockChain = {
          select: () => mockChain,
          insert: () => mockChain,
          update: () => mockChain,
          delete: () => mockChain,
          upsert: () => mockChain,
          eq: () => mockChain,
          neq: () => mockChain,
          gt: () => mockChain,
          gte: () => mockChain,
          lt: () => mockChain,
          lte: () => mockChain,
          in: () => mockChain,
          is: () => mockChain,
          like: () => mockChain,
          ilike: () => mockChain,
          contains: () => mockChain,
          range: () => mockChain,
          order: () => mockChain,
          limit: () => mockChain,
          // Promises
          single: () => Promise.resolve({ data: null, error: { message: "Database not connected" } }),
          maybeSingle: () => Promise.resolve({ data: null, error: { message: "Database not connected" } }),
          then: (resolve: any) => resolve({ data: [], error: { message: "Database not connected" } }) 
      };
      
      return {
          from: () => mockChain,
          storage: {
              from: () => ({
                  upload: () => Promise.resolve({ data: null, error: { message: "Storage not connected" } }),
                  getPublicUrl: () => ({ data: { publicUrl: "" } })
              })
          },
          channel: () => ({
              on: () => ({ subscribe: () => {} }),
              unsubscribe: () => {}
          }),
          removeChannel: () => {}
      };
    })();

export const supabase = client as any;
