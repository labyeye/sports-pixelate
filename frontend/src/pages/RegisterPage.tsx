import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Users,
  Clock,
  IndianRupee,
  BarChart2,
} from "lucide-react";
import nesthrlogo from "../../assets/logo.png";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
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

  const features = [
    { icon: Users, label: "Employee Management" },
    { icon: Clock, label: "Attendance Tracking" },
    { icon: IndianRupee, label: "Payroll Processing" },
    { icon: BarChart2, label: "Reports & Analytics" },
  ];

  return (
    <div className="min-h-screen flex">
      {}
      <div className="hidden lg:flex lg:w-1/2 bg-[#024BAB] flex-col justify-between p-10 relative overflow-hidden">
        {}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {}
        <div className="relative z-10">
          <img
            src={nesthrlogo}
            alt="NestSports"
            className="h-14 w-auto object-contain bg-white"
          />
        </div>

        {}
        <div className="relative z-10">
          <h1 className="text-4xl xl:text-5xl font-display font-bold text-white leading-tight mb-5">
            Every employee.
            <br />
            Every payslip.
            <br />
            One place.
          </h1>
          <p className="text-white/70 text-base font-medium max-w-sm">
            Manage your entire workforce — attendance, leaves, payroll and
            reports — all from a single dashboard.
          </p>
        </div>

        {}
        <div className="relative z-10 flex flex-wrap gap-2">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 text-white text-sm font-bold"
            >
              <Icon className="w-4 h-4 text-white/70" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src={nesthrlogo}
              alt="NestSports"
              className="h-12 w-auto object-contain"
            />
          </div>

          {}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-black">
              Create your account
            </h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Set up your HRMS workspace
            </p>
          </div>

          {}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 text-red-600 text-sm px-3 py-2.5 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {}
            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setError("");
                }}
                placeholder="John Smith"
                className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                required
                autoFocus
              />
            </div>

            {}
            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setError("");
                }}
                placeholder="you@sportsclub.com"
                className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                required
                autoComplete="email"
              />
            </div>

            {}
            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    setError("");
                  }}
                  placeholder="Min. 6 characters"
                  className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="px-3 border-l-2 border-black hover:bg-gray-50 transition-colors"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4 text-black" />
                  ) : (
                    <Eye className="w-4 h-4 text-black" />
                  )}
                </button>
              </div>
            </div>

            {}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {}
          <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
            <p className="text-xs text-gray-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-[#024BAB] hover:underline transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
