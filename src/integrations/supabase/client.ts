// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://knjbxqiyngztylnzxzln.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuamJ4cWl5bmd6dHlsbnp4emxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2MjU2NjUsImV4cCI6MjA0OTIwMTY2NX0.7peEOLQF8D39ScsSeFY9Wqb0qD0cWQZ_T37BU1CwG4Y";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);