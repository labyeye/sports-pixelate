import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, Users2 } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) navigate("/onboarding");
    else setError(result.error || "Registration failed.");
  };

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center">
            <Users2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-black">
            NestSports
          </span>
        </div>

        <h2 className="font-display font-bold text-3xl text-black mb-1">
          Create account
        </h2>
        <p className="text-muted-foreground text-sm mb-8">
          Set up your HRMS workspace ·{" "}
          <Link
            to="/login"
            className="font-bold text-black underline hover:text-[#FA731C] transition-colors"
          >
            Sign in
          </Link>
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] text-sm px-3 py-2.5 mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Smith"
              className="border-2 w-full px-3 py-2.5 text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              className="border-2 w-full px-3 py-2.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 6 characters"
              className="border-2 w-full px-3 py-2.5 text-sm"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="border-2 w-full bg-[#024BAB] text-white py-3 text-sm font-bold mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create Account →"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
