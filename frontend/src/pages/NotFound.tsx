import { Link } from "react-router-dom";
import { Users2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#024BAB] border-2 border-black mx-auto mb-6 flex items-center justify-center">
          <Users2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-display font-bold text-6xl text-black mb-2">404</h1>
        <p className="text-lg font-bold text-black mb-1">Page not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          This page doesn't exist in NestSports.
        </p>
        <Link to="/">
          <button className="border-2 bg-[#024BAB] text-white px-6 py-3 text-sm font-bold">
            ← Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
