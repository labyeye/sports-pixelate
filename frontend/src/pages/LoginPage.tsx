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
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import nesthrlogo from "../../assets/logo.png";
import { authAPI } from "@/services/api";

export default function LoginPage() {
  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState("");
  const [tfaCode, setTfaCode] = useState("");

  // Phone OTP state
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/");
    } else if (result.requires2FA) {
      setNeeds2FA(true);
      setPending2FAUserId(result.userId || "");
    } else if (result.error?.includes("Phone OTP")) {
      // Coaches, staff and parents don't have password login — bounce them
      // straight to the OTP flow instead of just showing an error.
      setLoginMode("phone");
      setError(result.error);
    } else {
      setError(result.error || "Login failed. Please check your credentials.");
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.verify2FA(pending2FAUserId, tfaCode);
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      await authAPI.sendPhoneOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const res = await authAPI.verifyPhoneOtp(phone.trim(), otp.trim());
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setOtpLoading(false);
    }
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

          {needs2FA ? (
            /* ── 2FA verification ──────────────────────────────────── */
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-7 h-7 text-[#024BAB]" />
                  <h2 className="text-2xl font-display font-bold text-black">
                    Two-Factor Auth
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 text-red-600 text-sm px-3 py-2.5 mb-5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handle2FASubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Authenticator Code
                  </label>
                  <input
                    type="text"
                    value={tfaCode}
                    onChange={(e) => {
                      setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                      setError("");
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 border-2 border-black text-lg font-bold tracking-[0.5em] text-center bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                    autoFocus
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    You can also enter a backup code.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || tfaCode.length < 6}
                  className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNeeds2FA(false);
                    setError("");
                    setTfaCode("");
                  }}
                  className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black transition-colors"
                >
                  ← Back to login
                </button>
              </form>
            </>
          ) : loginMode === "phone" ? (
            /* ── Phone OTP login ──────────────────────────────────── */
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="w-7 h-7 text-[#024BAB]" />
                  <h2 className="text-2xl font-display font-bold text-black">
                    {otpSent ? "Enter OTP" : "Phone Login"}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  {otpSent
                    ? "We sent a 6-digit OTP to your WhatsApp."
                    : "We'll send a one-time password to your WhatsApp."}
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 text-red-600 text-sm px-3 py-2.5 mb-5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError("");
                      }}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={otpLoading || !phone.trim()}
                    className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Sending...
                      </>
                    ) : (
                      <>
                        Send OTP on WhatsApp <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("email");
                      setError("");
                      setPhone("");
                    }}
                    className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black transition-colors"
                  >
                    ← Sign in with Email
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                      WhatsApp OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setError("");
                      }}
                      placeholder="000000"
                      className="w-full px-4 py-3 border-2 border-black text-lg font-bold tracking-[0.5em] text-center bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                      autoFocus
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={otpLoading || otp.length < 6}
                    className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black transition-colors"
                  >
                    ← Change number / Resend
                  </button>
                </form>
              )}
            </>
          ) : (
            /* ── Email / password login ───────────────────────────── */
            <>
              {}
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-black">
                  Welcome back
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  Sign in to your workspace
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
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@sportsclub.com"
                    className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:border-[#024BAB] transition-colors"
                    required
                    autoComplete="email"
                    autoFocus
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
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      placeholder="Your password"
                      className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                      required
                      autoComplete="current-password"
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
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-[#024BAB] hover:underline"
                  >
                    Forgot password?
                  </Link>
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("phone");
                    setError("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#024BAB] hover:underline"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Login with Phone OTP
                  (WhatsApp)
                </button>
              </div>

              {}
              <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
                <p className="text-xs text-gray-500">
                  New to NestSports?{" "}
                  <Link
                    to="/register"
                    className="font-bold text-[#024BAB] hover:underline transition-colors"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
