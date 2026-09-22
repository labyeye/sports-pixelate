import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Mail,
  CheckCircle,
  KeyRound,
  MessageCircle,
} from "lucide-react";
import { authAPI } from "@/services/api";
import nesthrlogo from "../../assets/logo.png";

type Step = "email" | "choose" | "email_sent" | "code" | "done";
type CodeMethod = "whatsapp" | "totp";

// Only methods the account has actually set up are offered (see /methods).
const METHOD_INFO: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode }
> = {
  email: {
    label: "Email link",
    desc: "Get a password reset link in your inbox",
    icon: <Mail className="w-5 h-5" />,
  },
  whatsapp: {
    label: "WhatsApp code",
    desc: "Get a 6-digit code on your verified WhatsApp number",
    icon: <MessageCircle className="w-5 h-5 text-green-600" />,
  },
  totp: {
    label: "Authenticator app",
    desc: "Enter the code from your authenticator app",
    icon: <KeyRound className="w-5 h-5" />,
  },
};

const labelCls =
  "block text-xs font-bold text-black uppercase tracking-wider mb-1.5";
const btnCls =
  "w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2 disabled:opacity-60";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState<CodeMethod>("whatsapp");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = (await authAPI.forgotPasswordMethods(email)) as any;
      setMethods(res.data.methods);
      if (res.data.methods.length > 1) return setStep("choose");
      await authAPI.forgotPassword(email);
      setStep("email_sent");
    });
  };

  const choose = (m: string) =>
    run(async () => {
      if (m === "email") {
        await authAPI.forgotPassword(email);
        return setStep("email_sent");
      }
      if (m === "whatsapp") await authAPI.forgotPasswordWhatsapp(email);
      setMethod(m as CodeMethod);
      setCode("");
      setStep("code");
    });

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    run(async () => {
      if (method === "whatsapp")
        await authAPI.resetPasswordWithOtp(email, code, password);
      else await authAPI.resetPasswordWithTotp(email, code, password);
      setStep("done");
    });
  };

  const backToLogin = (
    <Link
      to="/login"
      className="flex items-center justify-center gap-2 text-sm font-bold text-[#024BAB] hover:underline"
    >
      <ArrowLeft className="w-4 h-4" /> Back to login
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img
            src={nesthrlogo}
            alt="NestPlay"
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="bg-white border-2 border-black p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 text-red-600 text-sm px-3 py-2.5 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {step === "email" && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-black">
                  Forgot password?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email to see how you can reset your password.
                </p>
              </div>

              <form onSubmit={handleEmail} className="space-y-5">
                <div>
                  <label className={labelCls}>Email</label>
                  <div className="flex border-2 border-black focus-within:border-[#024BAB] transition-colors">
                    <span className="flex items-center px-3 border-r-2 border-black bg-gray-50">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@sportsclub.com"
                      className="flex-1 px-4 py-3 bg-white text-sm font-medium outline-none"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className={btnCls}>
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Checking...
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </form>
              <div className="mt-6">{backToLogin}</div>
            </>
          )}

          {step === "choose" && (
            <>
              <h2 className="text-2xl font-bold text-black mb-1">
                How do you want to reset it?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Choose one of the methods set up on your account.
              </p>
              <div className="space-y-3">
                {methods.map((m) => (
                  <button
                    key={m}
                    onClick={() => choose(m)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 border-2 border-black p-3.5 text-left hover:bg-[#F0F6FF] transition-colors disabled:opacity-50"
                  >
                    <span className="w-9 h-9 border-2 border-black flex items-center justify-center shrink-0">
                      {METHOD_INFO[m]?.icon}
                    </span>
                    <span>
                      <span className="block font-bold text-sm text-black">
                        {METHOD_INFO[m]?.label ?? m}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {METHOD_INFO[m]?.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("email")}
                className="text-xs font-bold text-gray-500 hover:text-black mt-6"
              >
                ← Back
              </button>
            </>
          )}

          {step === "email_sent" && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-14 h-14 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2">
                Check your email
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                If an account exists for <strong>{email}</strong>, we've sent a
                password reset link. It expires in 1 hour.
              </p>
              {backToLogin}
            </div>
          )}

          {step === "code" && (
            <>
              <h2 className="text-2xl font-bold text-black mb-1">
                {method === "whatsapp"
                  ? "Enter WhatsApp code"
                  : "Enter authenticator code"}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {method === "whatsapp"
                  ? "We sent a 6-digit code to your verified WhatsApp number."
                  : "Open your authenticator app and enter the current 6-digit code (or a backup code)."}
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className={labelCls}>
                    {method === "whatsapp" ? "WhatsApp code" : "Authenticator code"}
                  </label>
                  <input
                    type="text"
                    inputMode={method === "whatsapp" ? "numeric" : "text"}
                    maxLength={method === "whatsapp" ? 6 : 8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    placeholder="123456"
                    className="w-full px-3 py-3 border-2 border-black text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-[#024BAB]"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelCls}>New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ chars, upper, lower & a number"
                    className="w-full px-3 py-3 border-2 border-black text-sm outline-none focus:border-[#024BAB]"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirm new password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-black text-sm outline-none focus:border-[#024BAB]"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" disabled={loading} className={btnCls}>
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
              <button
                onClick={() => {
                  setError("");
                  setStep("choose");
                }}
                className="text-xs font-bold text-gray-500 hover:text-black mt-6"
              >
                ← Choose a different method
              </button>
            </>
          )}

          {step === "done" && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-14 h-14 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2">
                Password reset!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Your password has been changed. You can now sign in.
              </p>
              {backToLogin}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
