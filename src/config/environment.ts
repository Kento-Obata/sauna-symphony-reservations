// 環境変数が設定されていない場合のデフォルト値
const DEFAULT_BASE_URL = 'http://localhost:5173';

// Lovableプレビュー環境のURL
const PREVIEW_BASE_URL = 'https://sauna-symphony-reservations.lovable.app';

// 本番環境のURL
const PRODUCTION_BASE_URL = 'https://www.u-sauna-private.com';

// 環境に応じたURLを返す
export const BASE_URL = import.meta.env.VITE_BASE_URL || 
  (import.meta.env.PROD ? PRODUCTION_BASE_URL : 
    (import.meta.env.DEV ? DEFAULT_BASE_URL : PREVIEW_BASE_URL));