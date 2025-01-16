import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

// セッションの永続化を設定
const supabase = createClient(
  "https://knjbxqiyngztylnzxzln.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJ4cWl5bmd6dHlsbnp4emxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MjU2NjUsImV4cCI6MjA0OTIwMTY2NX0.7peEOLQF8D39ScsSeFY9Wqb0qD0cWQZ_T37BU1CwG4Y",
  {
    auth: {
      persistSession: true,
      storage: window.localStorage
    }
  }
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);