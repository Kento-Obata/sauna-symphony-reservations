import { useEffect } from 'react';
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { Toaster } from "sonner";

function App() {
  useEffect(() => {
    const loadFont = async () => {
      const font = new FontFace(
        'Zen Kaku Gothic New',
        'url(https://fonts.gstatic.com/s/zenkakugothicnew/v7/gNMVW2drQpDw0GjzrVNFf_vQPVMC9LJ2GkcbQGjcNWaKbA.woff2)'
      );

      try {
        await font.load();
        document.fonts.add(font);
        console.log('Zen Kaku Gothic New font loaded successfully');
      } catch (error) {
        console.error('Error loading Zen Kaku Gothic New font:', error);
      }
    };

    loadFont();
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </>
  );
}

export default App;