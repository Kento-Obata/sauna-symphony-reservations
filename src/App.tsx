import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { Toaster } from "sonner";

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "u-toast",
          },
        }}
      />
    </>
  );
}

export default App;
