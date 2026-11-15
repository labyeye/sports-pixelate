import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { biometricAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  CreditCard,
  User,
  Plus,
  X,
  Loader2,
  Search,
  Building2,
  BadgeCheck,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  designation?: string;
  department?: { _id: string; name: string } | string;
  email?: string;
  phone?: string;
}

interface NfcCard {
  uid: string;
  label?: string;
  personModel?: string;
  person: { _id: string } | null;
  assignedAt: string;
}

interface Device {
  _id: string;
  name: string;
  location: { _id: string; name: string };
  nfcCards: NfcCard[];
  isActive: boolean;
}

interface AssignedCard {
  uid: string;
  label?: string;
  deviceId: string;
  deviceName: string;
  locationName: string;
  assignedAt: string;
}

export default function NfcManagerPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [assignForm, setAssignForm] = useState({
    uid: "",
    deviceId: "",
    label: "",
  });
  const [assigning, setAssigning] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, devRes] = await Promise.all([
        employeeAPI.getAll({ limit: "5000" }),
        biometricAPI.getDevices(),
      ]);
      setEmployees(empRes.data || []);
      setDevices(devRes.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cardsByEmployee = new Map<string, AssignedCard[]>();
  for (const device of devices) {
    for (const card of device.nfcCards) {
      if (card.personModel === "student" || !card.person) continue; // students are managed on the Biometric Devices page
      const empId = card.person._id;
      if (!cardsByEmployee.has(empId)) cardsByEmployee.set(empId, []);
      cardsByEmployee.get(empId)!.push({
        uid: card.uid,
        label: card.label,
        deviceId: device._id,
        deviceName: device.name,
        locationName: device.location?.name,
        assignedAt: card.assignedAt,
      });
    }
  }

  const filteredEmployees = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      (e.designation || "").toLowerCase().includes(q)
    );
  });

  const selectedCards = selectedEmployee
    ? cardsByEmployee.get(selectedEmployee._id) || []
    : [];

  const handleAssign = async () => {
    if (
      !selectedEmployee ||
      !assignForm.uid.trim() ||
      !assignForm.deviceId ||
      assigning
    )
      return;
    setAssigning(true);
    try {
      await biometricAPI.assignNfcCard(
        assignForm.deviceId,
        assignForm.uid.trim(),
        "employee",
        selectedEmployee._id,
        assignForm.label,
      );
      toast({
        title: "NFC card assigned",
        description: `Card ${assignForm.uid} linked to ${selectedEmployee.firstName}`,
      });
      setAssignForm({ uid: "", deviceId: "", label: "" });
      setShowAssignForm(false);
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (card: AssignedCard) => {
    if (
      !confirm(
        `Remove NFC card ${card.uid} from ${selectedEmployee?.firstName}?`,
      )
    )
      return;
    try {
      await biometricAPI.removeNfcCard(card.deviceId, card.uid);
      toast({ title: "NFC card removed" });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deptName = (emp: Employee) => {
    if (!emp.department) return null;
    if (typeof emp.department === "string") return null;
    return emp.department.name;
  };

  return (
    <AppLayout title="NFC Manager">
      <div className="max-w-6xl mx-auto">
        {}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-black">
            NFC Card Manager
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Select an employee to view and manage their NFC card assignments
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {}
            <div className="lg:col-span-2">
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full border-2 border-black pl-9 pr-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {filteredEmployees.map((emp) => {
                  const cards = cardsByEmployee.get(emp._id) || [];
                  return (
                    <button
                      key={emp._id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setShowAssignForm(false);
                        setAssignForm({ uid: "", deviceId: "", label: "" });
                      }}
                      className={cn(
                        "w-full text-left p-4 border-2 transition-all",
                        selectedEmployee?._id === emp._id
                          ? "border-[#024BAB] bg-blue-50 border-2"
                          : "border-black bg-white hover:border-2",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {emp.employeeId}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {cards.length > 0 ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-[#024BAB] bg-blue-50 border border-blue-200 px-2 py-0.5">
                              <CreditCard className="w-3 h-3" />
                              {cards.length} card{cards.length > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-gray-400">
                              No card
                            </span>
                          )}
                        </div>
                      </div>
                      {emp.designation && (
                        <p className="text-xs text-gray-500 mt-1.5 font-medium">
                          {emp.designation}
                          {deptName(emp) && ` · ${deptName(emp)}`}
                        </p>
                      )}
                    </button>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <p className="text-center py-8 text-gray-400 font-medium text-sm">
                    No employees found
                  </p>
                )}
              </div>
            </div>

            {}
            <div className="lg:col-span-3">
              {!selectedEmployee ? (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-white py-24">
                  <div className="text-center">
                    <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                      Select an employee to manage their NFC cards
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-black">
                  {}
                  <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#024BAB] border-2 border-black flex items-center justify-center">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h2 className="font-bold text-xl">
                            {selectedEmployee.firstName}{" "}
                            {selectedEmployee.lastName}
                          </h2>
                          <p className="text-sm font-mono text-gray-500 mt-0.5">
                            {selectedEmployee.employeeId}
                          </p>
                          {selectedEmployee.designation && (
                            <p className="text-sm font-medium text-gray-600 mt-0.5">
                              {selectedEmployee.designation}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowAssignForm((p) => !p);
                          setAssignForm({ uid: "", deviceId: "", label: "" });
                        }}
                        className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-xs uppercase hover: transition-all"
                      >
                        <Plus className="w-4 h-4" /> Assign Card
                      </button>
                    </div>

                    {}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {selectedEmployee.email && (
                        <div className="bg-white border border-gray-200 px-3 py-2">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Email
                          </p>
                          <p className="text-sm font-medium mt-0.5">
                            {selectedEmployee.email}
                          </p>
                        </div>
                      )}
                      {selectedEmployee.phone && (
                        <div className="bg-white border border-gray-200 px-3 py-2">
                          <p className="text-xs font-bold uppercase text-gray-400">
                            Phone
                          </p>
                          <p className="text-sm font-medium mt-0.5">
                            {selectedEmployee.phone}
                          </p>
                        </div>
                      )}
                      {deptName(selectedEmployee) && (
                        <div className="bg-white border border-gray-200 px-3 py-2 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs font-bold uppercase text-gray-400">
                              Department
                            </p>
                            <p className="text-sm font-medium">
                              {deptName(selectedEmployee)}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="bg-white border border-gray-200 px-3 py-2 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-400">
                            NFC Cards
                          </p>
                          <p className="text-sm font-bold text-[#024BAB]">
                            {selectedCards.length} assigned
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {}
                  {showAssignForm && (
                    <div className="p-5 border-b-2 border-black bg-yellow-50">
                      <p className="text-xs font-bold uppercase mb-3 text-gray-600">
                        Assign New NFC Card to {selectedEmployee.firstName}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1">
                            NFC Card UID *
                          </label>
                          <input
                            value={assignForm.uid}
                            onChange={(e) =>
                              setAssignForm((p) => ({
                                ...p,
                                uid: e.target.value,
                              }))
                            }
                            placeholder="e.g. A3F2B1C0"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1">
                            Label (optional)
                          </label>
                          <input
                            value={assignForm.label}
                            onChange={(e) =>
                              setAssignForm((p) => ({
                                ...p,
                                label: e.target.value,
                              }))
                            }
                            placeholder="e.g. Main Card"
                            className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold uppercase mb-1">
                            Device *
                          </label>
                          <select
                            value={assignForm.deviceId}
                            onChange={(e) =>
                              setAssignForm((p) => ({
                                ...p,
                                deviceId: e.target.value,
                              }))
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                          >
                            <option value="">Select device</option>
                            {devices
                              .filter(
                                (d) => d.isActive && d.nfcCards.length < 10,
                              )
                              .map((d) => (
                                <option key={d._id} value={d._id}>
                                  {d.name} — {d.location?.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="col-span-2 flex gap-2">
                          <button
                            onClick={handleAssign}
                            disabled={
                              !assignForm.uid ||
                              !assignForm.deviceId ||
                              assigning
                            }
                            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-xs uppercase disabled:opacity-50"
                          >
                            {assigning && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            {assigning ? "Assigning..." : "Assign Card"}
                          </button>
                          <button
                            onClick={() => setShowAssignForm(false)}
                            className="border-2 border-black px-4 py-2 font-bold text-xs uppercase bg-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {}
                  <div className="p-5">
                    <h3 className="font-bold text-sm uppercase mb-4 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Assigned NFC Cards
                    </h3>

                    {selectedCards.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-200">
                        <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 font-medium">
                          No NFC cards assigned to this employee
                        </p>
                        <button
                          onClick={() => setShowAssignForm(true)}
                          className="mt-3 text-xs font-bold text-[#024BAB] hover:underline"
                        >
                          + Assign a card
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedCards.map((card) => (
                          <div
                            key={card.uid}
                            className="border-2 border-black p-4 bg-gray-50"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                                  <CreditCard className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-bold text-base font-mono">
                                    {card.uid}
                                  </p>
                                  {card.label && (
                                    <p className="text-xs font-medium text-gray-500">
                                      {card.label}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRevoke(card)}
                                className="p-1.5 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                                title="Remove NFC card"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                                <Cpu className="w-3.5 h-3.5 text-gray-400" />
                                {card.deviceName}
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                                <BadgeCheck className="w-3.5 h-3.5 text-green-500" />
                                {card.locationName}
                              </div>
                              <div className="col-span-2 text-gray-400">
                                Assigned:{" "}
                                {new Date(card.assignedAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
