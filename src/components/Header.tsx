import { Instagram } from 'lucide-react';

export const Header = () => {
  return (
    <header className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-sauna-base">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <a
          href="https://www.instagram.com/u__sauna/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/80 hover:text-black transition-colors"
        >
          <Instagram className="h-5 w-5" />
        </a>
      </div>
      
      <div className="relative z-10 w-full mx-auto text-center">
        <div className="h-24" />
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0 pb-8">
          <div className="space-y-1">
            <img 
              src="/lovable-uploads/1aa72bce-66cd-4327-8168-efd559ff3e6e.png" 
              alt="U" 
              className="w-full md:w-[500px] h-auto mx-auto"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
