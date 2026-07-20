import { useState, useEffect, useCallback, useRef } from "react";
import {
  biometricAPI,
  employeeAPI,
  studentAPI,
  PersonType,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { FaceEnrollModal } from "@/components/biometric/FaceEnrollModal";
import { FingerprintEnrollModal } from "@/components/biometric/FingerprintEnrollModal";
import {
  MapPin,
  Cpu,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  CreditCard,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Copy,
  Wifi,
  Monitor,
  Terminal,
  CheckCircle2,
  Radio,
  Upload,
  UserCheck,
  Scan,
  Hash,
  AlertTriangle,
  Clock,
  Camera,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "locations_devices" | "logs" | "adms";

interface Location {
  _id: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
}

interface NfcCard {
  uid: string;
  label?: string;
  personType: PersonType;
  person: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId?: string;
    studentId?: string;
  };
  assignedAt: string;
}

interface Device {
  _id: string;
  name: string;
  location: { _id: string; name: string; address?: string };
  deviceToken: string;
  activationCode: string;
  activated: boolean;
  activatedAt?: string;
  deviceMeta?: { model?: string; mac?: string; ip?: string };
  nfcCards: NfcCard[];
  isActive: boolean;
  lastSeenAt?: string;
  serialNumber?: string;
}

interface BiometricLog {
  _id: string;
  personType: PersonType;
  person: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId?: string;
    studentId?: string;
  };
  device: { _id: string; name: string };
  location: { _id: string; name: string };
  method: "nfc" | "face" | "pin";
  type: "check_in" | "check_out";
  nfcUid?: string;
  timestamp: string;
}

// A person from either the employee or student roster, generalized so every
// picker/action in this page (NFC assign, ADMS sync, face/fp enroll, biometric
// ID) can target either kind of person via the same personType-aware API.
interface Person {
  _id: string;
  personType: PersonType;
  firstName: string;
  lastName: string;
  code: string; // employeeId or studentId
  status?: string;
  biometricUserId?: string;
  rfidCard?: string;
  faceDescriptor?: number[];
  deviceFaceTemplate?: string;
}

function personCode(p: { employeeId?: string; studentId?: string }) {
  return p.employeeId || p.studentId || "";
}

export default function BiometricPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [tab, setTab] = useState<Tab>("locations_devices");

  const [locations, setLocations] = useState<Location[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locForm, setLocForm] = useState({
    name: "",
    address: "",
    description: "",
  });
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [showLocForm, setShowLocForm] = useState(false);
  const [locSaving, setLocSaving] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [showDevForm, setShowDevForm] = useState(false);
  const [devSaving, setDevSaving] = useState(false);
  const [devForm, setDevForm] = useState({ name: "", location: "" });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [nfcForm, setNfcForm] = useState<{
    uid: string;
    personType: PersonType;
    personId: string;
    label: string;
  }>({ uid: "", personType: "employee", personId: "", label: "" });
  const [people, setPeople] = useState<Person[]>([]);
  const [showTokenFor, setShowTokenFor] = useState<string | null>(null);

  const [logs, setLogs] = useState<BiometricLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ locationId: "", date: "" });

  const fetchLocations = useCallback(async () => {
    setLocLoading(true);
    try {
      const res = await biometricAPI.getLocations();
      setLocations(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLocLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await biometricAPI.getDevices();
      setDevices(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setDevLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (logFilter.locationId) params.locationId = logFilter.locationId;
      if (logFilter.date) params.date = logFilter.date;
      const res = await biometricAPI.getLogs(params);
      setLogs(res.data);
    } catch (e: any) {
      toastRef.current({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
    }
  }, [logFilter]);

  const fetchPeople = useCallback(async () => {
    try {
      const [empRes, stuRes] = await Promise.all([
        employeeAPI.getAll(),
        studentAPI.getAll(),
      ]);
      const emps: Person[] = (empRes.data || []).map((e: any) => ({
        _id: e._id,
        personType: "employee" as PersonType,
        firstName: e.firstName,
        lastName: e.lastName,
        code: e.employeeId,
        status: e.status,
        biometricUserId: e.biometricUserId,
        rfidCard: e.rfidCard,
        faceDescriptor: e.faceDescriptor,
        deviceFaceTemplate: e.deviceFaceTemplate,
      }));
      const stus: Person[] = (stuRes.data || []).map((s: any) => ({
        _id: s._id,
        personType: "student" as PersonType,
        firstName: s.firstName,
        lastName: s.lastName,
        code: s.studentId,
        status: s.status,
        biometricUserId: s.biometricUserId,
        rfidCard: s.rfidCard,
        faceDescriptor: s.faceDescriptor,
        deviceFaceTemplate: s.deviceFaceTemplate,
      }));
      setPeople([...emps, ...stus]);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);
  useEffect(() => {
    if (tab === "locations_devices") {
      fetchDevices();
      fetchPeople();
    }
  }, [tab, fetchDevices, fetchPeople]);
  useEffect(() => {
    if (tab === "logs") {
      fetchLogs();
      fetchDevices();
    }
  }, [tab, fetchLogs, fetchDevices]);

  const handleSaveLocation = async () => {
    if (!locForm.name.trim() || locSaving) return;
    const ok = window.confirm(
      editingLoc ? "Save changes to this location?" : "Create this location?",
    );
    if (!ok) return;
    setLocSaving(true);
    try {
      if (editingLoc) {
        const res = await biometricAPI.updateLocation(editingLoc, locForm);
        setLocations((prev) =>
          prev.map((l) => (l._id === editingLoc ? res.data : l)),
        );
        toast({ title: "Location updated" });
      } else {
        const res = await biometricAPI.createLocation(locForm);
        setLocations((prev) => [res.data, ...prev]);
        toast({ title: "Location created" });
      }
      setLocForm({ name: "", address: "", description: "" });
      setEditingLoc(null);
      setShowLocForm(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLocSaving(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    const ok = window.confirm(
      "Delete this location? Associated devices will be deactivated. This action cannot be undone.",
    );
    if (!ok) return;
    try {
      await biometricAPI.deleteLocation(id);
      setLocations((prev) => prev.filter((l) => l._id !== id));
      toast({ title: "Location deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEditLoc = (loc: Location) => {
    setEditingLoc(loc._id);
    setLocForm({
      name: loc.name,
      address: loc.address || "",
      description: loc.description || "",
    });
    setShowLocForm(true);
  };

  const handleCreateDevice = async () => {
    if (!devForm.name.trim() || !devForm.location || devSaving) return;
    const ok = window.confirm("Create this device?");
    if (!ok) return;
    setDevSaving(true);
    try {
      const res = await biometricAPI.createDevice(devForm);
      setDevices((prev) => [res.data, ...prev]);
      setDevForm({ name: "", location: "" });
      setShowDevForm(false);
      toast({
        title: "Device created",
        description: "Save the device token to open the device page.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDevSaving(false);
    }
  };

  const handleRegenerateToken = async (deviceId: string) => {
    const ok = window.confirm(
      "Regenerate token? Both the terminal URL and activation code will change — reconnection required. This action cannot be undone.",
    );
    if (!ok) return;
    try {
      const res = await biometricAPI.regenerateDeviceToken(deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d._id === deviceId
            ? {
                ...d,
                deviceToken: res.data.deviceToken,
                activationCode: res.data.activationCode,
                activated: false,
              }
            : d,
        ),
      );
      setSelectedDevice((prev) =>
        prev && prev._id === deviceId
          ? {
              ...prev,
              deviceToken: res.data.deviceToken,
              activationCode: res.data.activationCode,
              activated: false,
            }
          : prev,
      );
      toast({
        title: "Token regenerated",
        description: "New activation code is ready.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleDevice = async (device: Device) => {
    try {
      const res = await biometricAPI.updateDevice(device._id, {
        isActive: !device.isActive,
      });
      setDevices((prev) =>
        prev.map((d) =>
          d._id === device._id ? { ...d, isActive: res.data.isActive } : d,
        ),
      );
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteDevice = async (id: string) => {
    const ok = window.confirm(
      "Delete this device? This action cannot be undone.",
    );
    if (!ok) return;
    try {
      await biometricAPI.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d._id !== id));
      if (selectedDevice?._id === id) setSelectedDevice(null);
      toast({ title: "Device deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAssignNfc = async () => {
    if (!selectedDevice || !nfcForm.uid.trim() || !nfcForm.personId) return;
    try {
      const res = await biometricAPI.assignNfcCard(
        selectedDevice._id,
        nfcForm.uid,
        nfcForm.personType,
        nfcForm.personId,
        nfcForm.label || undefined,
      );
      setDevices((prev) =>
        prev.map((d) => (d._id === selectedDevice._id ? res.data : d)),
      );
      setSelectedDevice(res.data);
      setNfcForm({ uid: "", personType: "employee", personId: "", label: "" });
      toast({ title: "NFC card assigned" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveNfc = async (uid: string) => {
    if (!selectedDevice) return;
    try {
      const res = await biometricAPI.removeNfcCard(selectedDevice._id, uid);
      setDevices((prev) =>
        prev.map((d) => (d._id === selectedDevice._id ? res.data : d)),
      );
      setSelectedDevice(res.data);
      toast({ title: "NFC card removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const devicePageUrl = (token: string) =>
    `${window.location.origin}/device/${token}`;

  const [admsDevice, setAdmsDevice] = useState<Device | null>(null);
  const [admsSerial, setAdmsSerial] = useState("");
  const [serialSaving, setSerialSaving] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [commands, setCommands] = useState<any[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);

  const [faceEnrollPerson, setFaceEnrollPerson] = useState<Person | null>(null);
  const [fpEnrollPerson, setFpEnrollPerson] = useState<Person | null>(null);

  const [rfidModalPerson, setRfidModalPerson] = useState<Person | null>(null);
  const [rfidBuffer, setRfidBuffer] = useState("");
  const [rfidSaving, setRfidSaving] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const [editBioId, setEditBioId] = useState<{
    id: string;
    personType: PersonType;
    val: string;
  } | null>(null);

  const fetchCommands = useCallback(async (deviceId: string) => {
    setCmdLoading(true);
    try {
      const res = await biometricAPI.getDeviceCommands(deviceId);
      setCommands(res.data || []);
    } catch {}
    setCmdLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "adms") {
      fetchDevices();
      fetchPeople();
    }
  }, [tab, fetchDevices, fetchPeople]);

  useEffect(() => {
    if (admsDevice) {
      setAdmsSerial(
        admsDevice.serialNumber || admsDevice.deviceMeta?.mac || "",
      );
      fetchCommands(admsDevice._id);
    }
  }, [admsDevice, fetchCommands]);

  const handleSaveSerial = async () => {
    if (!admsDevice || !admsSerial.trim() || serialSaving) return;
    setSerialSaving(true);
    try {
      const res = await biometricAPI.setDeviceSerial(
        admsDevice._id,
        admsSerial.trim().toUpperCase(),
      );
      setAdmsDevice(res.data);
      toast({
        title: "Serial number saved",
        description: `Device linked to SN: ${admsSerial.toUpperCase()}`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSerialSaving(false);
  };

  const handleSyncPerson = async (person: Person, rfidCard?: string) => {
    if (!admsDevice) return;
    setSyncingId(person._id);
    try {
      await biometricAPI.syncPersonToDevice(
        admsDevice._id,
        person.personType,
        person._id,
        rfidCard,
      );
      toast({
        title: "Queued",
        description: `${person.firstName} will sync on next device poll`,
      });
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSyncingId(null);
  };

  const handleSyncAll = async () => {
    if (!admsDevice || syncingAll) return;
    setSyncingAll(true);
    try {
      const res = await biometricAPI.syncAllToDevice(admsDevice._id);
      toast({ title: "Bulk sync queued", description: res.message });
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSyncingAll(false);
  };

  const handleTriggerFaceEnroll = async (person: Person) => {
    if (!admsDevice) return;
    try {
      const res = await biometricAPI.enrollFaceOnDevice(
        admsDevice._id,
        person.personType,
        person._id,
      );
      toast({ title: "Face enrollment queued", description: res.message });
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handlePushFaceTemplate = async (person: Person) => {
    if (!admsDevice) return;
    try {
      const res = await biometricAPI.pushFaceTemplateToDevice(
        admsDevice._id,
        person.personType,
        person._id,
      );
      toast({ title: "Face template push queued", description: res.message });
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveBioId = async (person: Person) => {
    if (!editBioId) return;
    try {
      await biometricAPI.assignBiometricUserId(
        person.personType,
        person._id,
        editBioId.val,
      );
      setPeople((prev) =>
        prev.map((p) =>
          p._id === person._id && p.personType === person.personType
            ? { ...p, biometricUserId: editBioId.val }
            : p,
        ),
      );
      setEditBioId(null);
      toast({ title: "Biometric ID saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openRfidModal = (person: Person) => {
    setRfidModalPerson(person);
    setRfidBuffer("");
    setTimeout(() => rfidInputRef.current?.focus(), 100);
  };

  const handleRfidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && rfidBuffer.trim()) {
      handleSaveRfid(rfidBuffer.trim());
    }
  };

  const handleSaveRfid = async (card: string) => {
    if (!rfidModalPerson || rfidSaving) return;
    setRfidSaving(true);
    try {
      await biometricAPI.saveRfidCard(
        rfidModalPerson.personType,
        rfidModalPerson._id,
        card,
      );
      setPeople((prev) =>
        prev.map((p) =>
          p._id === rfidModalPerson._id &&
          p.personType === rfidModalPerson.personType
            ? { ...p, rfidCard: card }
            : p,
        ),
      );
      toast({
        title: "RFID card saved",
        description: `Card ${card} linked to ${rfidModalPerson.firstName}`,
      });
      setRfidModalPerson(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRfidSaving(false);
  };

  const SIDEBAR_ITEMS: { id: Tab; label: string; sub: string; icon: any }[] = [
    {
      id: "locations_devices",
      label: "Locations & Devices",
      sub: "Manage sites and terminals",
      icon: MapPin,
    },
    {
      id: "adms",
      label: "ADMS / ESSL Sync",
      sub: "Hardware device sync",
      icon: Radio,
    },
    {
      id: "logs",
      label: "Activity Logs",
      sub: "Punch history",
      icon: Activity,
    },
  ];

  return (
    <AppLayout title="Biometric System">
      <div className="max-w-6xl mx-auto">
        <div className="border-2 border-black bg-white overflow-hidden mb-6">
          <div className="flex">
            {SIDEBAR_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-3.5 text-left transition-all border-b-4",
                  idx < SIDEBAR_ITEMS.length - 1 && "border-r-2 border-r-black",
                  tab === item.id
                    ? "border-b-[#024BAB] bg-[#024BAB]/5"
                    : "border-b-transparent bg-white hover:bg-gray-50",
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    tab === item.id ? "text-[#024BAB]" : "text-gray-400",
                  )}
                />
                <div className="text-left">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      tab === item.id ? "text-[#024BAB]" : "text-black",
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {item.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {tab === "locations_devices" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#024BAB]" /> Locations
                </h2>
                <button
                  onClick={() => {
                    setShowLocForm(true);
                    setEditingLoc(null);
                    setLocForm({ name: "", address: "", description: "" });
                  }}
                  className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Location
                </button>
              </div>

              {showLocForm && (
                <div className="bg-white border-2 border-black p-6 mb-6">
                  <h3 className="font-bold mb-4">
                    {editingLoc ? "Edit Location" : "New Location"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1">
                        Location Name *
                      </label>
                      <input
                        value={locForm.name}
                        onChange={(e) =>
                          setLocForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="e.g. Main Gate"
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1">
                        Address
                      </label>
                      <input
                        value={locForm.address}
                        onChange={(e) =>
                          setLocForm((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        placeholder="e.g. Ground 1"
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold uppercase mb-1">
                        Description
                      </label>
                      <input
                        value={locForm.description}
                        onChange={(e) =>
                          setLocForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Optional description"
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSaveLocation}
                      disabled={locSaving}
                      className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
                    >
                      {locSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}{" "}
                      {locSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setShowLocForm(false);
                        setEditingLoc(null);
                      }}
                      className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {locLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
                </div>
              ) : locations.length === 0 ? (
                <div className="text-center py-12 bg-white border-2 border-black">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-bold text-gray-500">
                    No locations yet. Add one to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map((loc) => (
                    <div
                      key={loc._id}
                      className="bg-white border-2 border-black p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full border border-black",
                              loc.isActive ? "bg-green-500" : "bg-gray-300",
                            )}
                          />
                          <h3 className="font-bold text-base">{loc.name}</h3>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditLoc(loc)}
                            className="p-1.5 border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc._id)}
                            className="p-1.5 border-2 border-gray-200 hover:border-red-500 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {loc.address && (
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loc.address}
                        </p>
                      )}
                      {loc.description && (
                        <p className="text-xs text-gray-400 mt-1">
                          {loc.description}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-bold uppercase px-2 py-0.5 border-2",
                            loc.isActive
                              ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]"
                              : "bg-gray-100 text-gray-500 border-gray-300",
                          )}
                        >
                          {loc.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {
                            devices.filter((d) => d.location?._id === loc._id)
                              .length
                          }{" "}
                          devices
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 border-t-2 border-black pt-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-lg flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-[#024BAB]" /> Devices
                      </h2>
                      <button
                        onClick={() => setShowDevForm((p) => !p)}
                        className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-3 py-1.5 font-bold text-xs uppercase"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>

                    {showDevForm && (
                      <div className="bg-white border-2 border-black p-4 mb-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold uppercase mb-1">
                              Device Name *
                            </label>
                            <input
                              value={devForm.name}
                              onChange={(e) =>
                                setDevForm((p) => ({
                                  ...p,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="e.g. Entry Terminal 1"
                              className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase mb-1">
                              Location *
                            </label>
                            <select
                              value={devForm.location}
                              onChange={(e) =>
                                setDevForm((p) => ({
                                  ...p,
                                  location: e.target.value,
                                }))
                              }
                              className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none bg-white"
                            >
                              <option value="">Select location</option>
                              {locations
                                .filter((l) => l.isActive)
                                .map((l) => (
                                  <option key={l._id} value={l._id}>
                                    {l.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleCreateDevice}
                              disabled={devSaving}
                              className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2 font-bold text-xs uppercase disabled:opacity-60 flex items-center justify-center gap-1"
                            >
                              {devSaving && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              {devSaving ? "Creating..." : "Create"}
                            </button>
                            <button
                              onClick={() => setShowDevForm(false)}
                              className="flex-1 bg-white border-2 border-black py-2 font-bold text-xs uppercase"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {devLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {devices.map((dev) => (
                          <button
                            key={dev._id}
                            onClick={() => setSelectedDevice(dev)}
                            className={cn(
                              "w-full text-left p-4 border-2 transition-all",
                              selectedDevice?._id === dev._id
                                ? "border-[#024BAB] bg-blue-50"
                                : "border-black bg-white hover:border-[#024BAB]",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    dev.isActive
                                      ? "bg-green-500"
                                      : "bg-gray-300",
                                  )}
                                />
                                <span className="font-bold text-sm">
                                  {dev.name}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                {dev.nfcCards.length}/10
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {dev.location?.name}
                            </p>
                            {dev.lastSeenAt && (
                              <p className="text-xs text-gray-400 mt-1">
                                Last seen:{" "}
                                {new Date(dev.lastSeenAt).toLocaleString()}
                              </p>
                            )}
                          </button>
                        ))}
                        {devices.length === 0 && !devLoading && (
                          <div className="text-center py-8 text-gray-400 font-medium text-sm">
                            No devices yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-3">
                    {!selectedDevice ? (
                      <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-white py-20">
                        <div className="text-center">
                          <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-400 font-medium">
                            Select a device to manage
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border-2 border-black">
                        <div className="p-5 border-b-2 border-black">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-xl">
                                {selectedDevice.name}
                              </h3>
                              <p className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {selectedDevice.location?.name}
                                {selectedDevice.location?.address &&
                                  ` · ${selectedDevice.location.address}`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleToggleDevice(selectedDevice)
                                }
                                className="p-2 border-2 border-black hover:bg-gray-50 transition-all"
                                title={
                                  selectedDevice.isActive
                                    ? "Deactivate"
                                    : "Activate"
                                }
                              >
                                {selectedDevice.isActive ? (
                                  <ToggleRight className="w-4 h-4 text-green-600" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteDevice(selectedDevice._id)
                                }
                                className="p-2 border-2 border-black hover:bg-red-50 hover:border-red-500 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            {selectedDevice.activated ? (
                              <span className="flex items-center gap-1.5 text-xs font-bold text-[#00C48C] bg-[#00C48C]/10 border-2 border-[#00C48C] px-2 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Connected
                                {selectedDevice.deviceMeta?.model &&
                                  ` · ${selectedDevice.deviceMeta.model}`}
                                {selectedDevice.deviceMeta?.ip &&
                                  ` · ${selectedDevice.deviceMeta.ip}`}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs font-bold text-[#FA731C] bg-[#FA731C]/10 border-2 border-[#FA731C] px-2 py-1">
                                <Wifi className="w-3.5 h-3.5" />
                                Awaiting connection
                              </span>
                            )}
                            {selectedDevice.lastSeenAt && (
                              <span className="text-xs text-gray-400">
                                Last seen{" "}
                                {new Date(
                                  selectedDevice.lastSeenAt,
                                ).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="p-3 bg-blue-50 border-2 border-[#024BAB]/20">
                              <div className="flex items-center gap-2 mb-2">
                                <Monitor className="w-4 h-4 text-[#024BAB]" />
                                <span className="text-xs font-bold uppercase text-[#024BAB]">
                                  Option A — Browser Terminal (Tablet / Kiosk)
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-2">
                                Open this URL on any tablet or PC at the venue.
                                Works with NFC, PIN, and face modes.
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono bg-white border border-gray-200 px-2 py-1.5 text-gray-700 truncate">
                                  {showTokenFor === selectedDevice._id
                                    ? devicePageUrl(selectedDevice.deviceToken)
                                    : "••••••••••••••••••••••••••••••••"}
                                </code>
                                <button
                                  onClick={() =>
                                    setShowTokenFor(
                                      showTokenFor === selectedDevice._id
                                        ? null
                                        : selectedDevice._id,
                                    )
                                  }
                                  className="p-1.5 border-2 border-gray-200 hover:border-black"
                                  title="Show/hide URL"
                                >
                                  {showTokenFor === selectedDevice._id ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      devicePageUrl(selectedDevice.deviceToken),
                                    )
                                  }
                                  className="p-1.5 border-2 border-gray-200 hover:border-black"
                                  title="Copy URL"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={devicePageUrl(
                                    selectedDevice.deviceToken,
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 border-2 border-gray-200 hover:border-black"
                                  title="Open terminal"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>

                            <div className="p-3 bg-gray-50 border-2 border-gray-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Terminal className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-bold uppercase text-gray-600">
                                  Option B — Hardware Device / Local Agent
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mb-3">
                                Enter these details in the device web panel or
                                agent config. The device calls{" "}
                                <code className="bg-white px-1 border">
                                  /api/biometric/register
                                </code>{" "}
                                once with the activation code to auto-connect.
                              </p>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-500 w-28 shrink-0">
                                    Server URL
                                  </span>
                                  <code className="flex-1 text-xs font-mono bg-white border border-gray-200 px-2 py-1 text-gray-700 truncate">
                                    {window.location.origin}
                                    /api/biometric/register
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        `${window.location.origin}/api/biometric/register`,
                                      )
                                    }
                                    className="p-1 hover:text-black text-gray-400"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-500 w-28 shrink-0">
                                    Activation Code
                                  </span>
                                  <code className="flex-1 text-sm font-mono font-bold bg-white border-2 border-black px-2 py-1 text-black tracking-widest">
                                    {selectedDevice.activationCode || "——"}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        selectedDevice.activationCode,
                                      )
                                    }
                                    className="p-1 hover:text-black text-gray-400"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-xs text-gray-400">
                                  The device will call{" "}
                                  <code className="bg-white px-1 border">
                                    POST /register
                                  </code>{" "}
                                  with{" "}
                                  <code className="bg-white px-1 border">{`{ "activationCode": "XXXXXXXX" }`}</code>{" "}
                                  and receive back the permanent device token.
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                handleRegenerateToken(selectedDevice._id)
                              }
                              className="flex items-center gap-1 text-xs font-bold text-red-500 hover:underline"
                            >
                              <RefreshCw className="w-3 h-3" /> Regenerate token
                              (invalidates both URLs)
                            </button>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold flex items-center gap-2">
                              <CreditCard className="w-4 h-4" /> NFC Cards
                              <span className="text-xs font-medium text-gray-500">
                                ({selectedDevice.nfcCards.length}/10)
                              </span>
                            </h4>
                          </div>

                          {selectedDevice.nfcCards.length < 10 && (
                            <div className="border-2 border-dashed border-gray-300 p-4 mb-4">
                              <p className="text-xs font-bold uppercase mb-3 text-gray-500">
                                Assign New Card
                              </p>
                              <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold uppercase mb-1">
                                      NFC Card UID *
                                    </label>
                                    <input
                                      value={nfcForm.uid}
                                      onChange={(e) =>
                                        setNfcForm((p) => ({
                                          ...p,
                                          uid: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. A3F2B1C0"
                                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium font-mono focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold uppercase mb-1">
                                      Label (optional)
                                    </label>
                                    <input
                                      value={nfcForm.label}
                                      onChange={(e) =>
                                        setNfcForm((p) => ({
                                          ...p,
                                          label: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. Card #1"
                                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-bold uppercase mb-1">
                                      Type *
                                    </label>
                                    <div className="flex border-2 border-black">
                                      {(
                                        ["employee", "student"] as PersonType[]
                                      ).map((t) => (
                                        <button
                                          key={t}
                                          type="button"
                                          onClick={() =>
                                            setNfcForm((p) => ({
                                              ...p,
                                              personType: t,
                                              personId: "",
                                            }))
                                          }
                                          className={cn(
                                            "flex-1 py-2 text-xs font-bold uppercase",
                                            nfcForm.personType === t
                                              ? "bg-[#024BAB] text-white"
                                              : "bg-white text-black hover:bg-gray-50",
                                          )}
                                        >
                                          {t === "employee"
                                            ? "Staff"
                                            : "Student"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold uppercase mb-1">
                                      {nfcForm.personType === "employee"
                                        ? "Staff *"
                                        : "Student *"}
                                    </label>
                                    <select
                                      value={nfcForm.personId}
                                      onChange={(e) =>
                                        setNfcForm((p) => ({
                                          ...p,
                                          personId: e.target.value,
                                        }))
                                      }
                                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                                    >
                                      <option value="">Select…</option>
                                      {people
                                        .filter(
                                          (p) =>
                                            p.personType === nfcForm.personType,
                                        )
                                        .map((p) => (
                                          <option key={p._id} value={p._id}>
                                            {p.firstName} {p.lastName} ({p.code}
                                            )
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                                <button
                                  onClick={handleAssignNfc}
                                  disabled={!nfcForm.uid || !nfcForm.personId}
                                  className="bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-xs uppercase disabled:opacity-50"
                                >
                                  Assign Card
                                </button>
                              </div>
                            </div>
                          )}

                          {selectedDevice.nfcCards.length === 0 ? (
                            <p className="text-sm text-gray-400 font-medium text-center py-4">
                              No NFC cards assigned
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {selectedDevice.nfcCards.map((card) => (
                                <div
                                  key={card.uid}
                                  className="flex items-center justify-between p-3 border-2 border-black bg-gray-50"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center">
                                      <CreditCard className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm font-mono">
                                        {card.uid}
                                      </p>
                                      <p className="text-xs text-gray-500 font-medium">
                                        {card.person.firstName}{" "}
                                        {card.person.lastName} ·{" "}
                                        {personCode(card.person)}
                                        {card.personType === "student" &&
                                          " · Student"}
                                        {card.label && ` · ${card.label}`}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveNfc(card.uid)}
                                    className="p-1.5 hover:text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-200 transition-all"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "logs" && (
            <div>
              <div className="border-2 border-black bg-white mb-6">
                <div className="flex items-center justify-between p-4 border-b-2 border-black">
                  <h3 className="font-bold text-sm text-black uppercase tracking-wider">
                    Device Sync Log
                  </h3>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-black bg-[#024BAB]/5">
                        {["Device", "Location", "Last Sync", "Status"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {devices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            No devices configured
                          </td>
                        </tr>
                      ) : (
                        devices.map((dev, i) => (
                          <tr
                            key={dev._id}
                            className={cn(
                              "border-b border-black/10",
                              i % 2 !== 0 && "bg-[#F8FAFF]",
                            )}
                          >
                            <td className="px-4 py-3 font-bold text-black">
                              {dev.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {dev.location?.name || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-black">
                              {dev.lastSeenAt
                                ? new Date(dev.lastSeenAt).toLocaleString(
                                    "en-IN",
                                  )
                                : "Never"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "px-2 py-0.5 text-xs font-bold border-2",
                                  dev.isActive
                                    ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]"
                                    : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
                                )}
                              >
                                {dev.isActive ? "Online" : "Offline"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6">
                <select
                  value={logFilter.locationId}
                  onChange={(e) =>
                    setLogFilter((p) => ({
                      ...p,
                      locationId: e.target.value,
                    }))
                  }
                  className="border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none"
                >
                  <option value="">All Locations</option>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={logFilter.date}
                  onChange={(e) =>
                    setLogFilter((p) => ({ ...p, date: e.target.value }))
                  }
                  className="border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                />
                <button
                  onClick={fetchLogs}
                  className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 bg-white border-2 border-black">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-bold text-gray-500">
                    No biometric activity found
                  </p>
                </div>
              ) : (
                <div className="bg-white border-2 border-black overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-black bg-[#024BAB] text-white">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Person
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Location
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Device
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Method
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Type
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, i) => (
                        <tr
                          key={log._id}
                          className={cn(
                            "border-b border-gray-100",
                            i % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                          )}
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-sm">
                              {log.person.firstName} {log.person.lastName}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {personCode(log.person)}
                              {log.personType === "student" && " · Student"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              {log.location.name}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-600">
                            {log.device.name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-bold uppercase px-2 py-0.5 border-2",
                                log.method === "nfc"
                                  ? "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]"
                                  : log.method === "face"
                                    ? "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]"
                                    : "bg-gray-100 text-gray-500 border-gray-300",
                              )}
                            >
                              {log.method === "nfc"
                                ? "NFC"
                                : log.method === "face"
                                  ? "Face"
                                  : "PIN"}
                            </span>
                            {log.nfcUid && (
                              <p className="text-xs font-mono text-gray-400 mt-0.5">
                                {log.nfcUid}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-bold uppercase px-2 py-0.5 border-2 flex items-center gap-1 w-fit",
                                log.type === "check_in"
                                  ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]"
                                  : "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
                              )}
                            >
                              <Clock className="w-3 h-3" />
                              {log.type === "check_in"
                                ? "Check In"
                                : "Check Out"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                            <p>
                              {new Date(log.timestamp).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "adms" && (
            <div className="space-y-6">
              <div className="border-2 border-black p-5">
                <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-black text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  Select Device (ESSL MB-20 / ZKTeco)
                </h2>
                <div className="p-3 bg-gray-50 border-2 border-gray-200 mb-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Any device that speaks the{" "}
                    <strong>ADMS / iClock push</strong> protocol (most ZKTeco
                    and eSSL biometric terminals) works here. On the device:{" "}
                    <strong>Menu → Comm → Cloud Server Setting</strong> → enable
                    ADMS, then set:
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 w-28 shrink-0">
                      Server Address
                    </span>
                    <code className="flex-1 text-xs font-mono bg-white border border-gray-200 px-2 py-1 text-gray-700 truncate">
                      sports-backend.pixelatenest.com
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          window.location.origin.replace(/^https?:\/\//, ""),
                        )
                      }
                      className="p-1 hover:text-black text-gray-400"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-500 w-28 shrink-0">
                      Server Port
                    </span>
                    <code className="flex-1 text-xs font-mono bg-white border border-gray-200 px-2 py-1 text-gray-700">
                      {window.location.protocol === "https:" ? "443" : "80"}
                    </code>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Then register the device's serial number below (step 2).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {devices.map((d) => (
                    <button
                      key={d._id}
                      onClick={() => setAdmsDevice(d)}
                      className={cn(
                        "text-left p-4 border-2 transition-all",
                        admsDevice?._id === d._id
                          ? "border-[#024BAB] bg-blue-50"
                          : "border-black hover:bg-gray-50",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Cpu className="w-4 h-4" />
                        <span className="font-bold text-sm">{d.name}</span>
                        {d.serialNumber && (
                          <span className="ml-auto text-[10px] font-mono bg-[#00C48C]/10 text-[#00C48C] px-1.5 py-0.5 border-2 border-[#00C48C]">
                            SN: {d.serialNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {d.location?.name}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">
                        {d.lastSeenAt
                          ? `Last seen: ${new Date(d.lastSeenAt).toLocaleString()}`
                          : "Never connected via ADMS"}
                      </p>
                    </button>
                  ))}
                  {devices.length === 0 && (
                    <p className="text-sm text-gray-500 col-span-3">
                      No devices found — create one in the Devices tab first.
                    </p>
                  )}
                </div>
              </div>

              {admsDevice && (
                <>
                  <div className="border-2 border-black p-5">
                    <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2">
                      <span className="w-6 h-6 bg-black text-white text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      Register ADMS Serial Number
                    </h2>
                    <p className="text-xs text-gray-500 mb-4">
                      Find the SN on the device:{" "}
                      <strong>Menu → System Info → Device SN</strong>. This
                      links attendance pushes from this device to{" "}
                      <strong>{admsDevice.name}</strong>.
                    </p>
                    <div className="flex gap-3 items-end max-w-md">
                      <div className="flex-1">
                        <label className="block text-xs font-bold uppercase mb-1">
                          Serial Number (SN)
                        </label>
                        <input
                          value={admsSerial}
                          onChange={(e) =>
                            setAdmsSerial(e.target.value.toUpperCase())
                          }
                          placeholder="e.g. AB1C2D3E4F"
                          className="w-full border-2 border-black px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#024BAB]"
                        />
                      </div>
                      <button
                        onClick={handleSaveSerial}
                        disabled={serialSaving || !admsSerial.trim()}
                        className="border-2 bg-[#024BAB] text-white px-4 py-2 font-bold text-sm disabled:opacity-40 flex items-center gap-2"
                      >
                        {serialSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </div>
                    {admsDevice.serialNumber && (
                      <p className="text-xs text-green-700 font-bold mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Currently registered: {admsDevice.serialNumber}
                      </p>
                    )}
                  </div>

                  <div className="border-2 border-black">
                    <div className="px-5 py-4 border-b-2 border-black flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-bold text-base flex items-center gap-2">
                          <span className="w-6 h-6 bg-black text-white text-xs font-bold flex items-center justify-center">
                            3
                          </span>
                          Staff & Students — Assign IDs & Sync to Device
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Set each person's device user ID (number from device
                          user list), optionally assign RFID, then sync.
                        </p>
                      </div>
                      <button
                        onClick={handleSyncAll}
                        disabled={syncingAll || !admsDevice.serialNumber}
                        className="border-2 bg-[#024BAB] text-white px-4 py-2 font-bold text-xs disabled:opacity-40 flex items-center gap-2 shrink-0"
                      >
                        {syncingAll ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Sync All
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-black bg-gray-50">
                            <th className="text-left px-4 py-3 font-bold text-xs uppercase">
                              Person
                            </th>
                            <th className="text-left px-4 py-3 font-bold text-xs uppercase">
                              Device User ID
                            </th>
                            <th className="text-left px-4 py-3 font-bold text-xs uppercase">
                              RFID Card
                            </th>
                            <th className="text-right px-4 py-3 font-bold text-xs uppercase">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                          {people
                            .filter(
                              (p) =>
                                p.status !== "terminated" &&
                                p.status !== "inactive",
                            )
                            .map((person) => (
                              <tr
                                key={`${person.personType}-${person._id}`}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-4 py-3">
                                  <p className="font-bold">
                                    {person.firstName} {person.lastName}
                                  </p>
                                  <p className="text-xs text-gray-500 font-mono">
                                    {person.code}
                                    {person.personType === "student" &&
                                      " · Student"}
                                  </p>
                                </td>

                                {/* Biometric User ID cell — inline edit */}
                                <td className="px-4 py-3">
                                  {editBioId !== null &&
                                  editBioId.id === person._id &&
                                  editBioId.personType === person.personType ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        value={editBioId.val}
                                        onChange={(e) =>
                                          setEditBioId({
                                            id: person._id,
                                            personType: person.personType,
                                            val: e.target.value,
                                          })
                                        }
                                        onKeyDown={(e) =>
                                          e.key === "Enter" &&
                                          handleSaveBioId(person)
                                        }
                                        autoFocus
                                        className="w-20 border-2 border-[#024BAB] px-2 py-1 font-mono text-xs focus:outline-none"
                                      />
                                      <button
                                        onClick={() => handleSaveBioId(person)}
                                        className="text-green-600 hover:text-green-800"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditBioId(null)}
                                        className="text-gray-400 hover:text-gray-700"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setEditBioId({
                                          id: person._id,
                                          personType: person.personType,
                                          val: person.biometricUserId || "",
                                        })
                                      }
                                      className={cn(
                                        "flex items-center gap-1.5 font-mono text-xs px-2 py-1 border-2",
                                        person.biometricUserId
                                          ? "border-[#00C48C] bg-[#00C48C]/10 text-[#00C48C]"
                                          : "border-dashed border-gray-300 text-gray-400 hover:border-gray-500",
                                      )}
                                    >
                                      <Hash className="w-3 h-3" />
                                      {person.biometricUserId || "Set ID"}
                                    </button>
                                  )}
                                </td>

                                {/* RFID card cell */}
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => openRfidModal(person)}
                                    className={cn(
                                      "flex items-center gap-1.5 font-mono text-xs px-2 py-1 border-2",
                                      person.rfidCard
                                        ? "border-[#024BAB] bg-[#024BAB]/10 text-[#024BAB]"
                                        : "border-dashed border-gray-300 text-gray-400 hover:border-gray-500",
                                    )}
                                  >
                                    <CreditCard className="w-3 h-3" />
                                    {person.rfidCard || "Assign RFID"}
                                  </button>
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                    {/* Face enroll via PC webcam */}
                                    <button
                                      onClick={() =>
                                        setFaceEnrollPerson(person)
                                      }
                                      title="Enroll face via PC webcam"
                                      className={cn(
                                        " px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 border-2",
                                        person.faceDescriptor?.length === 128
                                          ? "bg-purple-100 border-purple-400 text-purple-800"
                                          : "bg-white border-black hover:bg-gray-50",
                                      )}
                                    >
                                      <Camera className="w-3 h-3" />
                                      {person.faceDescriptor?.length === 128
                                        ? "Re-enroll Face"
                                        : "Face"}
                                    </button>

                                    {/* Fingerprint enroll trigger */}
                                    {person.biometricUserId && admsDevice && (
                                      <button
                                        onClick={() =>
                                          setFpEnrollPerson(person)
                                        }
                                        title="Trigger fingerprint enrollment on device"
                                        className=" px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 bg-white border-2 border-black hover:bg-gray-50"
                                      >
                                        <Fingerprint className="w-3 h-3" /> FP
                                        Enroll
                                      </button>
                                    )}

                                    {/* Face enroll / push template on physical ADMS device */}
                                    {person.biometricUserId && admsDevice && (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleTriggerFaceEnroll(person)
                                          }
                                          title="Send command to device — person stands in front of device to scan face"
                                          className=" px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 bg-green-50 border-2 border-green-600 text-green-800 hover:bg-green-100"
                                        >
                                          <Scan className="w-3 h-3" />{" "}
                                          {person.deviceFaceTemplate
                                            ? "Re-Enroll"
                                            : "Face Enroll"}
                                        </button>
                                        {person.deviceFaceTemplate && (
                                          <button
                                            onClick={() =>
                                              handlePushFaceTemplate(person)
                                            }
                                            title="Push stored face template to this device (for people enrolled on another device)"
                                            className=" px-2 py-1.5 text-[10px] font-bold flex items-center gap-1 bg-blue-50 border-2 border-blue-600 text-blue-800 hover:bg-blue-100"
                                          >
                                            <Scan className="w-3 h-3" /> Push
                                            Face
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {/* Sync to device */}
                                    {person.biometricUserId ? (
                                      <button
                                        onClick={() => handleSyncPerson(person)}
                                        disabled={
                                          syncingId === person._id ||
                                          !admsDevice.serialNumber
                                        }
                                        className="border-2 bg-[#024BAB] text-white px-2 py-1.5 text-[10px] font-bold disabled:opacity-40 flex items-center gap-1"
                                      >
                                        {syncingId === person._id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <UserCheck className="w-3 h-3" />
                                        )}
                                        Sync
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />{" "}
                                        Set ID
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Command queue status */}
                  <div className="border-2 border-black">
                    <div className="px-5 py-4 border-b-2 border-black flex items-center justify-between">
                      <h2 className="font-display font-bold text-base flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> Command Queue
                      </h2>
                      <button
                        onClick={() => fetchCommands(admsDevice._id)}
                        className=" bg-white border-2 border-black px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    {cmdLoading ? (
                      <div className="p-6 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                      </div>
                    ) : commands.length === 0 ? (
                      <p className="p-6 text-sm text-gray-400 text-center">
                        No commands yet — sync a person to create one.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b-2 border-black bg-gray-50">
                              <th className="text-left px-4 py-2 font-bold uppercase">
                                ID
                              </th>
                              <th className="text-left px-4 py-2 font-bold uppercase">
                                Type
                              </th>
                              <th className="text-left px-4 py-2 font-bold uppercase">
                                Person
                              </th>
                              <th className="text-left px-4 py-2 font-bold uppercase">
                                Status
                              </th>
                              <th className="text-left px-4 py-2 font-bold uppercase">
                                Created
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/10">
                            {commands.map((cmd) => (
                              <tr key={cmd._id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-mono">
                                  {cmd.cmdId}
                                </td>
                                <td className="px-4 py-2 font-bold">
                                  {cmd.type}
                                </td>
                                <td className="px-4 py-2">
                                  {cmd.person
                                    ? `${cmd.person.firstName} ${cmd.person.lastName}`
                                    : "—"}
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 border-2 font-bold text-[10px] uppercase",
                                      cmd.status === "done" &&
                                        "bg-[#00C48C]/10 border-[#00C48C] text-[#00C48C]",
                                      cmd.status === "pending" &&
                                        "bg-[#FA731C]/10 border-[#FA731C] text-[#FA731C]",
                                      cmd.status === "sent" &&
                                        "bg-[#024BAB]/10 border-[#024BAB] text-[#024BAB]",
                                      cmd.status === "failed" &&
                                        "bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]",
                                    )}
                                  >
                                    {cmd.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 font-mono text-gray-400">
                                  {new Date(cmd.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── FACE ENROLLMENT MODAL ────────────────────────────────────────── */}
          {faceEnrollPerson && (
            <FaceEnrollModal
              person={{
                _id: faceEnrollPerson._id,
                personType: faceEnrollPerson.personType,
                firstName: faceEnrollPerson.firstName,
                lastName: faceEnrollPerson.lastName,
                code: faceEnrollPerson.code,
                faceDescriptor: faceEnrollPerson.faceDescriptor,
              }}
              onClose={() => setFaceEnrollPerson(null)}
              onSaved={(personId) => {
                setPeople((prev) =>
                  prev.map((p) =>
                    p._id === personId &&
                    p.personType === faceEnrollPerson.personType
                      ? { ...p, faceDescriptor: new Array(128).fill(0) }
                      : p,
                  ),
                );
                setFaceEnrollPerson(null);
              }}
            />
          )}

          {/* ── FINGERPRINT ENROLLMENT MODAL ─────────────────────────────────── */}
          {fpEnrollPerson && admsDevice && (
            <FingerprintEnrollModal
              device={admsDevice}
              person={{
                _id: fpEnrollPerson._id,
                personType: fpEnrollPerson.personType,
                firstName: fpEnrollPerson.firstName,
                lastName: fpEnrollPerson.lastName,
                code: fpEnrollPerson.code,
                biometricUserId: fpEnrollPerson.biometricUserId,
              }}
              onClose={() => setFpEnrollPerson(null)}
            />
          )}

          {/* ── USB RFID ENROLLMENT MODAL ─────────────────────────────────────── */}
          {rfidModalPerson && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="border-2 border-black w-full max-w-md bg-white">
                <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between">
                  <h2 className="font-display font-bold text-base flex items-center gap-2">
                    <Scan className="w-4 h-4" /> Scan RFID Card
                  </h2>
                  <button
                    onClick={() => setRfidModalPerson(null)}
                    className="hover:opacity-70"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-blue-50 border-2 border-blue-300 p-4">
                    <p className="font-bold text-sm text-blue-800">
                      {rfidModalPerson.firstName} {rfidModalPerson.lastName}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {rfidModalPerson.code}
                    </p>
                  </div>

                  {/* Option A: USB HID reader — captures as keyboard input */}
                  <div>
                    <p className="text-xs font-bold uppercase mb-2 text-gray-600">
                      Option A — USB RFID Reader
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      Plug in your USB RFID reader. Click the field below, then
                      swipe / tap the card — the reader types the card number
                      automatically.
                    </p>
                    <div className="relative">
                      <input
                        ref={rfidInputRef}
                        value={rfidBuffer}
                        onChange={(e) => setRfidBuffer(e.target.value)}
                        onKeyDown={handleRfidKeyDown}
                        placeholder="Click here, then scan card..."
                        className="w-full border-2 border-black px-3 py-3 font-mono text-sm focus:outline-none focus:border-[#024BAB] pr-20"
                        autoFocus
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">
                        Press Enter to save
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="text-xs font-bold">OR</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>

                  {/* Option B: manual entry */}
                  <div>
                    <p className="text-xs font-bold uppercase mb-2 text-gray-600">
                      Option B — Manual Entry
                    </p>
                    <input
                      value={rfidBuffer}
                      onChange={(e) => setRfidBuffer(e.target.value)}
                      placeholder="Type card number manually..."
                      className="w-full border-2 border-black px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#024BAB]"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleSaveRfid(rfidBuffer)}
                      disabled={!rfidBuffer.trim() || rfidSaving}
                      className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {rfidSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Save RFID Card
                    </button>
                    <button
                      onClick={() => setRfidModalPerson(null)}
                      className=" bg-white border-2 border-black px-5 py-2.5 font-bold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
