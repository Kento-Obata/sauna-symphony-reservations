import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const [backgroundImage, setBackgroundImage] = useState<string>('/placeholder.svg');

  useEffect(() => {
    const generateImage = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-sauna-image');
        
        if (error) {
          console.error('Error generating image:', error);
          return;
        }

        if (data.data && data.data[0].url) {
          setBackgroundImage(data.data[0].url);
        }
      } catch (error) {
        console.error('Error invoking function:', error);
      }
    };

    generateImage();
  }, []);

  return (
    <header className="relative h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${backgroundImage}')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/90 to-sauna-charcoal/70 backdrop-blur-sm z-0" />
      <div className="relative z-10 text-center px-4 animate-fade-up">
        <h1 className="text-8xl font-bold mb-6 text-gradient">U</h1>
        <p className="text-xl mb-8 text-sauna-stone">
          福岡、宇美町。五感で味わう究極のサウナ
        </p>
        <p className="text-lg text-sauna-stone/80 max-w-2xl mx-auto">
          5℃から17℃まで、お好きな水風呂の温度を教えてください。
          あとは我々にお任せを。
        </p>
      </div>
    </header>
  );
};

export default Header;