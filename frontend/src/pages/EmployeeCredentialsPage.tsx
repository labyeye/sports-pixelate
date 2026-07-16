import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { employeeAPI, authAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Employee } from "@/types/hrms";
import { cn, formatDate } from "@/lib/utils";
import {
  Search,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  X,
  Building2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeCredentialsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    selectedEmployee: null as Employee | null,
    password: "",
  });
  const [managerCredentials, setManagerCredentials] = useState<any>(null);
  const [showEditManagerForm, setShowEditManagerForm] = useState(false);
  const [managerPassword, setManagerPassword] = useState("");
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });
  const companyId = user?.company?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { status: "active" };
      if (search) params.search = search;

      const res = await employeeAPI.getAll(params);
      if (res.success) {
        setEmployees(res.data);
      }
    } catch {}
    setLoading(false);
  }, [search, companyId]);

  useEffect(() => {
    load();

    fetchManagerCredentials();
  }, [load]);

  useEffect(() => {
    if (actionModal.show && actionModal.type === "success") {
      const timer = setTimeout(() => {
        setActionModal({ ...actionModal, show: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionModal.show, actionModal.type]);

  const fetchManagerCredentials = async () => {
    try {
      if (user?.email) {
        setManagerCredentials({
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }
    } catch {}
  };

  const handleResetPassword = async () => {
    if (!selectedEmp || !newPassword) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: "Please set a password",
      });
      return;
    }

    setUpdating(true);
    try {
      const res = await employeeAPI.resetPassword(selectedEmp._id, newPassword);

      if (res.success) {
        await navigator.clipboard.writeText(
          `Email: ${selectedEmp.email}\nPassword: ${newPassword}`,
        );

        setActionModal({
          show: true,
          type: "success",
          title: "Password Reset Successfully",
          message:
            "Credentials copied to clipboard. Share with employee securely.",
        });

        setTimeout(() => {
          setShowModal(false);
          setNewPassword("");
          setSelectedEmp(null);
        }, 1500);
      } else {
        setActionModal({
          show: true,
          type: "error",
          title: "Error",
          message: res.error || "Failed to reset password",
        });
      }
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to reset password",
      });
    }
    setUpdating(false);
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const handleCreateCredential = async () => {
    if (!createFormData.selectedEmployee || !createFormData.password) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: "Please select employee and set password",
      });
      return;
    }

    setUpdating(true);
    try {
      const res = await employeeAPI.resetPassword(
        createFormData.selectedEmployee._id,
        createFormData.password,
      );

      if (res.success) {
        await navigator.clipboard.writeText(
          `Email: ${createFormData.selectedEmployee.email}\nPassword: ${createFormData.password}`,
        );

        setActionModal({
          show: true,
          type: "success",
          title: "Credential Created Successfully",
          message:
            "Credentials created and copied to clipboard. Share securely.",
        });

        setTimeout(() => {
          setShowCreateForm(false);
          setCreateFormData({ selectedEmployee: null, password: "" });
        }, 1500);
      } else {
        setActionModal({
          show: true,
          type: "error",
          title: "Error",
          message: res.error || "Failed to create credential",
        });
      }
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to create credential",
      });
    }
    setUpdating(false);
  };

  const handleEditManagerAccount = async () => {
    if (!managerPassword) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: "Please enter new password",
      });
      return;
    }

    setUpdating(true);
    try {
      const res = await authAPI.updateProfile({
        password: managerPassword,
      });

      if (res.success) {
        await navigator.clipboard.writeText(
          `Email: ${user?.email}\nPassword: ${managerPassword}`,
        );

        setActionModal({
          show: true,
          type: "success",
          title: "Password Updated Successfully",
          message: "Your account updated. New credentials copied to clipboard.",
        });

        setTimeout(() => {
          setShowEditManagerForm(false);
          setManagerPassword("");
        }, 1500);
      } else {
        setActionModal({
          show: true,
          type: "error",
          title: "Error",
          message: res.error || "Failed to update account",
        });
      }
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to update account",
      });
    }
    setUpdating(false);
  };

  return (
    <AppLayout title="Employee Credentials">
      {}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-display font-bold text-black">
            Login Credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee credentials for{" "}
            {user?.company?.name || "your SportsClub"}
          </p>
        </div>
      </div>

      {}
      <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 mb-5">
        <Search className="w-4 h-4 shrink-0" />
        <input
          type="text"
          placeholder="Search employees by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none w-full font-medium"
        />
      </div>

      {}
      <div className=" bg-white p-4 mb-5 border-2 border-[#024BAB] bg-[#024BAB]/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase">
              SportsClub
            </p>
            <p className="text-sm font-bold text-black">
              {user?.company?.name || "Not assigned"}
            </p>
          </div>
        </div>
      </div>

      {}
      {managerCredentials && (
        <div className=" bg-white p-4 mb-5 border-2 border-[#00C48C] bg-[#00C48C]/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                Your Account ({managerCredentials.role?.replace(/_/g, " ")})
              </p>
              <p className="text-sm font-bold text-black">
                {managerCredentials.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {managerCredentials.email}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditManagerForm(true)}
                className="px-3 py-1.5 text-xs font-bold border-2 border-[#00C48C] hover:bg-[#00C48C] hover:text-white transition-colors"
              >
                ✏️ Edit Account
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-3 py-1.5 bg-[#00C48C] text-white text-xs font-bold border-2 border-[#00C48C] hover:bg-[#00B87C] transition-colors"
              >
                ➕ Create New
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : employees.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Lock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employees found</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Email",
                  "Designation",
                  "Last Updated",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr
                  key={emp._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {emp.avatar ? (
                        <img
                          src={emp.avatar}
                          alt="Profile"
                          className="w-8 h-8 object-cover border-2 border-black rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {emp.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-black">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-black font-medium">
                    {emp.email}
                  </td>
                  <td className="px-4 py-3 text-black">{emp.designation}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(emp.joinDate)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedEmp(emp);
                        setNewPassword("");
                        setShowModal(true);
                      }}
                      className="flex items-center gap-1 text-xs font-bold border-2 border-black px-3 py-1.5 hover:bg-[#024BAB] hover:text-white transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      {showModal && selectedEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Reset Password</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedEmp(null);
                  setNewPassword("");
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {}
              <div className="p-3 bg-[#024BAB]/5 border-2 border-[#024BAB]">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Employee
                </p>
                <p className="font-bold text-black text-sm">
                  {selectedEmp.firstName} {selectedEmp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedEmp.email}
                </p>
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  New Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                      placeholder="Enter or generate password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 py-2 border-2 border-black hover:bg-[#024BAB]/10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-xs font-bold text-[#024BAB] hover:underline"
                >
                  💡 Generate Strong Password
                </button>
              </div>

              {}
              <div className="p-3 bg-[#FFD60A]/10 border-2 border-[#FFD60A]">
                <p className="text-xs font-bold text-[#FFD60A] mb-1">
                  ℹ️ Share Securely
                </p>
                <p className="text-xs text-muted-foreground">
                  Credentials will be copied to clipboard. Share via secure
                  channels only.
                </p>
              </div>

              {}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleResetPassword}
                  disabled={updating || !newPassword}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Copy & Reset
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEmp(null);
                    setNewPassword("");
                  }}
                  className=" bg-white text-black px-6 py-2.5 text-sm font-bold border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white z-10">
              <h3 className="font-display font-bold text-lg">
                Create New Credential
              </h3>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateFormData({ selectedEmployee: null, password: "" });
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  Select Employee
                </label>
                <select
                  value={createFormData.selectedEmployee?._id || ""}
                  onChange={(e) => {
                    const emp = employees.find(
                      (emp) => emp._id === e.target.value,
                    );
                    setCreateFormData({
                      ...createFormData,
                      selectedEmployee: emp || null,
                    });
                  }}
                  className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              {}
              {createFormData.selectedEmployee && (
                <div className="p-3 bg-[#024BAB]/5 border-2 border-[#024BAB]">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                    Employee
                  </p>
                  <p className="font-bold text-black text-sm">
                    {createFormData.selectedEmployee.firstName}{" "}
                    {createFormData.selectedEmployee.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {createFormData.selectedEmployee.email}
                  </p>
                </div>
              )}

              {}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={createFormData.password}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          password: e.target.value,
                        })
                      }
                      placeholder="Enter or generate password"
                      className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 py-2 border-2 border-black hover:bg-[#024BAB]/10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const chars =
                      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
                    let pwd = "";
                    for (let i = 0; i < 12; i++) {
                      pwd += chars.charAt(
                        Math.floor(Math.random() * chars.length),
                      );
                    }
                    setCreateFormData({ ...createFormData, password: pwd });
                  }}
                  className="text-xs font-bold text-[#024BAB] hover:underline"
                >
                  💡 Generate Strong Password
                </button>
              </div>

              {}
              <div className="p-3 bg-[#FFD60A]/10 border-2 border-[#FFD60A]">
                <p className="text-xs font-bold text-[#FFD60A] mb-1">
                  ℹ️ New Credential
                </p>
                <p className="text-xs text-muted-foreground">
                  Create a new login credential for another employee or team
                  member.
                </p>
              </div>

              {}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateCredential}
                  disabled={
                    updating ||
                    !createFormData.selectedEmployee ||
                    !createFormData.password
                  }
                  className="border-2 bg-[#00C48C] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Create & Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateFormData({ selectedEmployee: null, password: "" });
                  }}
                  className=" bg-white text-black px-6 py-2.5 text-sm font-bold border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {showEditManagerForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Edit Your Account
              </h3>
              <button
                onClick={() => {
                  setShowEditManagerForm(false);
                  setManagerPassword("");
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {}
              <div className="p-3 bg-[#00C48C]/5 border-2 border-[#00C48C]">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Your Account
                </p>
                <p className="font-bold text-black text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-2 capitalize">
                  {user?.role?.replace(/_/g, " ")}
                </p>
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  New Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-black text-sm focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                      placeholder="Enter new password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 py-2 border-2 border-black hover:bg-[#024BAB]/10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const chars =
                      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
                    let pwd = "";
                    for (let i = 0; i < 12; i++) {
                      pwd += chars.charAt(
                        Math.floor(Math.random() * chars.length),
                      );
                    }
                    setManagerPassword(pwd);
                  }}
                  className="text-xs font-bold text-[#024BAB] hover:underline"
                >
                  💡 Generate Strong Password
                </button>
              </div>

              {}
              <div className="p-3 bg-[#FFD60A]/10 border-2 border-[#FFD60A]">
                <p className="text-xs font-bold text-[#FFD60A] mb-1">
                  ℹ️ Update Your Password
                </p>
                <p className="text-xs text-muted-foreground">
                  Your new credentials will be copied to clipboard for secure
                  storage.
                </p>
              </div>

              {}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEditManagerAccount}
                  disabled={updating || !managerPassword}
                  className="border-2 bg-[#00C48C] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Update & Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEditManagerForm(false);
                    setManagerPassword("");
                  }}
                  className=" bg-white text-black px-6 py-2.5 text-sm font-bold border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {actionModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            {actionModal.type === "success" ? (
              <>
                <div className="mb-4 animate-bounce">
                  <CheckCircle className="w-16 h-16 text-[#00C48C]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-[#00C48C] rounded-full animate-pulse delay-200" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 animate-bounce">
                  <AlertCircle className="w-16 h-16 text-[#EF4444]" />
                </div>
                <h2 className="text-2xl font-display font-bold text-black mb-2">
                  {actionModal.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {actionModal.message}
                </p>
                <button
                  onClick={() =>
                    setActionModal({ ...actionModal, show: false })
                  }
                  className="mt-4 px-6 py-2 bg-[#EF4444] text-white text-sm font-bold border-2 border-[#EF4444] hover:bg-[#EF4444]/90 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
