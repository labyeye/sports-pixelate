import {
  Users,
  Clock,
  IndianRupee,
  BarChart2,
  Baby,
  Wallet,
} from "lucide-react";
import nesthrlogo from "../../../assets/logo.png";
import loginDash from "../../../assets/login-dash.png";

const features = [
  { icon: Baby, label: "Student Management" },
  { icon: Users, label: "Employee Management" },
  { icon: Clock, label: "Attendance Tracking" },
  { icon: IndianRupee, label: "Payroll Processing" },
  { icon: Wallet, label: "Fees Management" },
  { icon: BarChart2, label: "Reports & Analytics" },
];

// Same split layout as LoginPage: blue pitch panel stays, only the right-hand form changes.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#024BAB] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <img
            src={nesthrlogo}
            alt="NestAcademy"
            className="h-14 w-auto object-contain bg-white"
          />
        </div>
        <img
          src={loginDash}
          alt="Dashboard preview"
          className="relative z-10 max-w-auto mx-auto"
        />

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
      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src={nesthrlogo}
              alt="NestAcademy"
              className="h-12 w-auto object-contain"
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
