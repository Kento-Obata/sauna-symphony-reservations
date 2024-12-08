import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Generating image with OpenAI...')
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A serene and atmospheric sauna landscape. In the foreground, weathered rocks and traditional Japanese burnt cedar (shou sugi ban) wood panels create a striking contrast. Tall cedar trees sway in the wind, their movement captured in a artistic blur. Copper architectural elements catch the light, adding warm metallic accents. The scene should feel both natural and designed, capturing the essence of a high-end sauna retreat. Style: moody, architectural photography with dramatic lighting.",
        n: 1,
        size: "1792x1024",
        quality: "hd"
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to generate image')
    }

    const data = await response.json()
    console.log('Image generated successfully')
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in generate-sauna-image function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})