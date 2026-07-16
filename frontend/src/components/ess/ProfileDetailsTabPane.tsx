import React, { useState } from "react";
import { employeeAPI } from "@/services/api";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Award,
  BookOpen,
  Heart,
  Shield,
  CreditCard,
  Briefcase,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  employee: any;
  toast: any;
  onRefresh: () => void;
}

export function ProfileDetailsTabPane({ employee, toast, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);

  // States for subdocuments
  const [panNumber, setPanNumber] = useState(employee.panNumber || "");
  const [bankAccount, setBankAccount] = useState(employee.bankAccount || "");
  const [ifscCode, setIfscCode] = useState(employee.ifscCode || "");
  const [emergencyContact, setEmergencyContact] = useState(
    employee.emergencyContact || "",
  );

  const [nominees, setNominees] = useState<any[]>(employee.nominees || []);
  const [familyDetails, setFamilyDetails] = useState<any[]>(
    employee.familyDetails || [],
  );
  const [education, setEducation] = useState<any[]>(employee.education || []);
  const [experience, setExperience] = useState<any[]>(
    employee.experience || [],
  );
  const [skills, setSkills] = useState<string[]>(employee.skills || []);
  const [certificates, setCertificates] = useState<any[]>(
    employee.certificates || [],
  );

  const [newSkill, setNewSkill] = useState("");

  // Handlers for adding items
  const addNominee = () => {
    setNominees([
      ...nominees,
      { name: "", relationship: "", dateOfBirth: "", percentage: 100 },
    ]);
  };

  const addFamily = () => {
    setFamilyDetails([
      ...familyDetails,
      { name: "", relationship: "", dateOfBirth: "", phone: "" },
    ]);
  };

  const addEducation = () => {
    setEducation([
      ...education,
      {
        degree: "",
        school: "",
        passYear: new Date().getFullYear(),
        percentage: "",
      },
    ]);
  };

  const addExperience = () => {
    setExperience([
      ...experience,
      { company: "", role: "", start: "", end: "", description: "" },
    ]);
  };

  const addCertificate = () => {
    setCertificates([
      ...certificates,
      { name: "", issuer: "", date: "", docUrl: "" },
    ]);
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await employeeAPI.update(employee._id, {
        panNumber,
        bankAccount,
        ifscCode,
        emergencyContact,
        nominees,
        familyDetails,
        education,
        experience,
        skills,
        certificates,
      });

      if (res.success) {
        toast({
          title: "Profile Details Updated",
          description: "Successfully updated profile lists.",
        });
        onRefresh();
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Save Button Header */}
      <div className="border-2 border-black bg-white p-5 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold uppercase mb-1">
            Detailed Profile Details
          </h3>
          <p className="text-xs text-muted-foreground">
            Keep your family details, education records, and skills updated.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-[#FA731C] text-white border-2 border-black px-5 py-2.5 font-bold text-xs uppercase disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Details"}
        </button>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank & Identification */}
        <div className="border-2 border-black bg-white overflow-hidden">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-white" />
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Bank & Verification
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  PAN Number
                </label>
                <input
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  placeholder="ABCDE1234F"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Emergency Contact
                </label>
                <input
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name / Mobile"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Bank Account
                </label>
                <input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Account Number"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  IFSC Code
                </label>
                <input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="IFSC Code"
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Skills Tag Input */}
        <div className="border-2 border-black bg-white overflow-hidden">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
            <Award className="w-4 h-4 text-white" />
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Skills Tags
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill (e.g. React, Node.js)"
                className="flex-1 border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
              />
              <button
                type="button"
                onClick={addSkill}
                className="bg-black text-white px-4 py-2 text-xs font-bold uppercase"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((s, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 text-xs font-bold uppercase border-2 border-black px-2.5 py-1 bg-[#F8FAFF]"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(idx)}
                    className="text-red-500 hover:text-black ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No skills added yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Nominee Details */}
        <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Nominees
              </p>
            </div>
            <button
              type="button"
              onClick={addNominee}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-white bg-black/25 px-2 py-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Nominee
            </button>
          </div>
          <div className="p-5 space-y-3">
            {nominees.map((n, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Nominee Name
                  </label>
                  <input
                    value={n.name}
                    onChange={(e) => {
                      const updated = [...nominees];
                      updated[i].name = e.target.value;
                      setNominees(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Relationship
                  </label>
                  <input
                    value={n.relationship}
                    onChange={(e) => {
                      const updated = [...nominees];
                      updated[i].relationship = e.target.value;
                      setNominees(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Spouse / Parent / Child"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Share Percentage (%)
                  </label>
                  <input
                    type="number"
                    value={n.percentage}
                    onChange={(e) => {
                      const updated = [...nominees];
                      updated[i].percentage = Number(e.target.value);
                      setNominees(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNominees(nominees.filter((_, idx) => idx !== i))
                  }
                  className="bg-red-50 text-red-600 border border-red-600 px-3 py-1.5 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            ))}
            {nominees.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No nominee details specified.
              </p>
            )}
          </div>
        </div>

        {/* Family Details */}
        <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Family Details
              </p>
            </div>
            <button
              type="button"
              onClick={addFamily}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-white bg-black/25 px-2 py-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Member
            </button>
          </div>
          <div className="p-5 space-y-3">
            {familyDetails.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Member Name
                  </label>
                  <input
                    value={f.name}
                    onChange={(e) => {
                      const updated = [...familyDetails];
                      updated[i].name = e.target.value;
                      setFamilyDetails(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Relationship
                  </label>
                  <input
                    value={f.relationship}
                    onChange={(e) => {
                      const updated = [...familyDetails];
                      updated[i].relationship = e.target.value;
                      setFamilyDetails(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Spouse / Mother / Father / Child"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    value={f.phone}
                    onChange={(e) => {
                      const updated = [...familyDetails];
                      updated[i].phone = e.target.value;
                      setFamilyDetails(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Phone"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFamilyDetails(
                      familyDetails.filter((_, idx) => idx !== i),
                    )
                  }
                  className="bg-red-50 text-red-600 border border-red-600 px-3 py-1.5 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            ))}
            {familyDetails.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No family details specified.
              </p>
            )}
          </div>
        </div>

        {/* Education Details */}
        <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Education History
              </p>
            </div>
            <button
              type="button"
              onClick={addEducation}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-white bg-black/25 px-2 py-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Record
            </button>
          </div>
          <div className="p-5 space-y-3">
            {education.map((e, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Degree / Course
                  </label>
                  <input
                    value={e.degree}
                    onChange={(val) => {
                      const updated = [...education];
                      updated[i].degree = val.target.value;
                      setEducation(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="e.g. B.Tech Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    School / University
                  </label>
                  <input
                    value={e.school}
                    onChange={(val) => {
                      const updated = [...education];
                      updated[i].school = val.target.value;
                      setEducation(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Institution name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Pass Out Year
                  </label>
                  <input
                    type="number"
                    value={e.passYear}
                    onChange={(val) => {
                      const updated = [...education];
                      updated[i].passYear = Number(val.target.value);
                      setEducation(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEducation(education.filter((_, idx) => idx !== i))
                  }
                  className="bg-red-50 text-red-600 border border-red-600 px-3 py-1.5 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            ))}
            {education.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No education history added.
              </p>
            )}
          </div>
        </div>

        {/* Experience Details */}
        <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Work Experience
              </p>
            </div>
            <button
              type="button"
              onClick={addExperience}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-white bg-black/25 px-2 py-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Experience
            </button>
          </div>
          <div className="p-5 space-y-3">
            {experience.map((e, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    SportsClub
                  </label>
                  <input
                    value={e.company}
                    onChange={(val) => {
                      const updated = [...experience];
                      updated[i].company = val.target.value;
                      setExperience(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="SportsClub Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Job Role
                  </label>
                  <input
                    value={e.role}
                    onChange={(val) => {
                      const updated = [...experience];
                      updated[i].role = val.target.value;
                      setExperience(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="e.g. Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Dates (Start - End)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Start date"
                      value={e.start}
                      onChange={(val) => {
                        const updated = [...experience];
                        updated[i].start = val.target.value;
                        setExperience(updated);
                      }}
                      className="w-1/2 border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="End date / Present"
                      value={e.end}
                      onChange={(val) => {
                        const updated = [...experience];
                        updated[i].end = val.target.value;
                        setExperience(updated);
                      }}
                      className="w-1/2 border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExperience(experience.filter((_, idx) => idx !== i))
                  }
                  className="bg-red-50 text-red-600 border border-red-600 px-3 py-1.5 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            ))}
            {experience.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No prior work experience listed.
              </p>
            )}
          </div>
        </div>

        {/* Certificates */}
        <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Certifications
              </p>
            </div>
            <button
              type="button"
              onClick={addCertificate}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-white bg-black/25 px-2 py-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Certificate
            </button>
          </div>
          <div className="p-5 space-y-3">
            {certificates.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Certification Name
                  </label>
                  <input
                    value={c.name}
                    onChange={(val) => {
                      const updated = [...certificates];
                      updated[i].name = val.target.value;
                      setCertificates(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="Certificate Title"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Issuing Organization
                  </label>
                  <input
                    value={c.issuer}
                    onChange={(val) => {
                      const updated = [...certificates];
                      updated[i].issuer = val.target.value;
                      setCertificates(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="e.g. AWS, Oracle, Google"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Verification / Certificate URL
                  </label>
                  <input
                    value={c.docUrl}
                    onChange={(val) => {
                      const updated = [...certificates];
                      updated[i].docUrl = val.target.value;
                      setCertificates(updated);
                    }}
                    className="w-full border border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                    placeholder="URL link"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCertificates(certificates.filter((_, idx) => idx !== i))
                  }
                  className="bg-red-50 text-red-600 border border-red-600 px-3 py-1.5 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            ))}
            {certificates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No certifications listed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
