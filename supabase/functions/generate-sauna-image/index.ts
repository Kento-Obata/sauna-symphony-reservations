import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Function called with method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { 
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    console.log('Starting image generation process...');
    
    // Verify OpenAI API key exists
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    console.log('Making request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A serene and atmospheric sauna landscape. In the foreground, weathered rocks and traditional Japanese burnt cedar (shou sugi ban) wood panels create a striking contrast. Tall cedar trees sway in the wind, their movement captured in a artistic blur. Copper architectural elements catch the light, adding warm metallic accents. The scene should feel both natural and designed, capturing the essence of a high-end sauna retreat. Style: moody, architectural photography with dramatic lighting.",
        n: 1,
        size: "1792x1024",
        quality: "hd"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Successfully generated image');
    
    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in generate-sauna-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'An error occurred while generating the image'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    );
  }
});