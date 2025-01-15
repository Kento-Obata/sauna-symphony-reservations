import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const navigate = useNavigate();

  return (
    <header className="w-full">
      <div className="container px-4 py-3">
        <nav className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-4">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader className="text-left">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <Link
                    to="/"
                    className="text-sm font-light px-2 py-1 hover:text-sauna-copper transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    to="/reservation/lookup"
                    className="text-sm font-light px-2 py-1 hover:text-sauna-copper transition-colors"
                  >
                    予約照会
                  </Link>
                  <Link
                    to="/admin"
                    className="text-sm font-light px-2 py-1 hover:text-sauna-copper transition-colors"
                  >
                    Admin
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-sm font-light hover:text-sauna-copper transition-colors"
              onClick={() => navigate("/reservation/lookup")}
            >
              予約照会
            </Button>
          </div>
        </nav>
      </div>

      <div className="container px-4 py-12 md:py-24 text-center">
        <div className="max-w-[800px] mx-auto">
          <div className="relative inline-block">
            <img
              src="/lovable-uploads/894a74ce-8ce3-4d60-b0fb-1f4e1794ab78.png"
              alt="U" 
              className="h-24 w-auto mx-auto"
            />
            <h2 className="text-sm font-extralight tracking-widest text-[#D38248] mt-1">ユー</h2>
            <div className="space-y-1">
              <p className="text-xs font-extralight tracking-widest">1日3組限定</p>
              <p className="text-xs font-extralight tracking-wider">all inclusive private sauna</p>
            </div>
            <p className="text-xs text-sauna-stone/70 mt-2">
              pre-opening<br />
              2025.02.20
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <h1 className="text-4xl font-light">
              Experience the Ultimate
              <br />
              Private Sauna
            </h1>
            <p className="text-lg text-sauna-stone/90 font-light">
              Discover tranquility in our exclusive private sauna experience
            </p>
          </div>

          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => {
                const element = document.getElementById("reservation-section");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Reserve Now
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}