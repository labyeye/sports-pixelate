import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Type,
  Eye,
  FileText,
  User,
  Phone,
  Mail,
  Globe,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventTypePicker } from "./EventTypePicker";
import { ActivityPicker } from "./ActivityPicker";
import { VenueSection } from "./sections/VenueSection";
import { ScheduleSection } from "./sections/ScheduleSection";
import { ParticipationSection } from "./sections/ParticipationSection";
import { CategoriesSection } from "./sections/CategoriesSection";
import { FeesSection } from "./sections/FeesSection";
import { AwardsSection } from "./sections/AwardsSection";
import { OfficialsSection } from "./sections/OfficialsSection";
import { AutomationSection } from "./sections/AutomationSection";
import { SportFieldsSection } from "./sections/SportFieldsSection";
import { DanceFieldsSection } from "./sections/DanceFieldsSection";
import { WorkshopFieldsSection } from "./sections/WorkshopFieldsSection";
import { PerformanceFieldsSection } from "./sections/PerformanceFieldsSection";
import { FileUpload } from "@/components/ui/FileUpload";
import {
  getSectionsForEventType,
  resolveActivityCategory,
  type EventTypeKey,
} from "@/config/eventTypeConfig";
import type { Event } from "@/types/hrms";

// Same step-through tab pattern as the student enrollment form
// (StudentsPage.tsx's showForm modal) — numbered pills, one group of fields
// visible at a time, Prev/Next/step-dots footer.
const EVENT_FORM_TABS = [
  "Basic Info",
  "Contact & Media",
  "Venue & Schedule",
  "Participation & Fees",
  "Awards & Officials",
  "Type Details",
] as const;

export interface EventFormPayload {
  name: string;
  eventType: string;
  activity: string;
  format: string;
  startDate?: string;
  endDate?: string;
  entryFee?: number;
  teams?: string[];
  description?: string;
  organizerName?: string;
  contactPerson?: string;
  mobileNumber?: string;
  email?: string;
  website?: string;
  schedule?: Event["schedule"];
  venue?: Event["venue"];
  participation?: Event["participation"];
  categories?: Event["categories"];
  fees?: Event["fees"];
  awards?: Event["awards"];
  automation?: Event["automation"];
  sportFields?: Event["sportFields"];
  danceFields?: Event["danceFields"];
  workshopFields?: Event["workshopFields"];
  performanceFields?: Event["performanceFields"];
  visibility?: string;
}

export type StagedOfficial = {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
};

interface EventFormProps {
  mode: "create" | "edit";
  initialValue?: Event;
  onSubmit: (
    payload: EventFormPayload,
    files: { coverImage?: File; bannerImage?: File },
    stagedOfficials: StagedOfficial[],
  ) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const DEFAULT_SCHEDULE: NonNullable<Event["schedule"]> = {};
const DEFAULT_VENUE: NonNullable<Event["venue"]> = {};
const DEFAULT_PARTICIPATION: NonNullable<Event["participation"]> = {
  type: "team",
};
const DEFAULT_CATEGORIES: NonNullable<Event["categories"]> = {
  ageCategory: [],
  gender: [],
  skillLevel: [],
  division: [],
};
const DEFAULT_FEES: NonNullable<Event["fees"]> = { currency: "INR" };
const DEFAULT_AWARDS: NonNullable<Event["awards"]> = { specialAwards: [] };
const DEFAULT_AUTOMATION: NonNullable<Event["automation"]> = {};
const DEFAULT_SPORT: NonNullable<Event["sportFields"]> = {};
const DEFAULT_DANCE: NonNullable<Event["danceFields"]> = {
  judgingCriteria: [],
};
const DEFAULT_WORKSHOP: NonNullable<Event["workshopFields"]> = {};
const DEFAULT_PERFORMANCE: NonNullable<Event["performanceFields"]> = {};

const inputClass =
  "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "flex items-center gap-1.5 text-xs font-bold uppercase mb-1";

export function EventForm({
  mode,
  initialValue,
  onSubmit,
  onCancel,
  saving,
}: EventFormProps) {
  const [name, setName] = useState(initialValue?.name || "");
  const [eventType, setEventType] = useState<string>(
    initialValue?.eventType || "tournament",
  );
  const [activity, setActivity] = useState(initialValue?.activity || "");
  const [format, setFormat] = useState(initialValue?.format || "knockout");
  const [startDate, setStartDate] = useState(
    initialValue?.startDate?.slice(0, 10) || "",
  );
  const [endDate, setEndDate] = useState(
    initialValue?.endDate?.slice(0, 10) || "",
  );
  const [description, setDescription] = useState(
    initialValue?.description || "",
  );
  const [organizerName, setOrganizerName] = useState(
    initialValue?.organizerName || "",
  );
  const [contactPerson, setContactPerson] = useState(
    initialValue?.contactPerson || "",
  );
  const [mobileNumber, setMobileNumber] = useState(
    initialValue?.mobileNumber || "",
  );
  const [email, setEmail] = useState(initialValue?.email || "");
  const [website, setWebsite] = useState(initialValue?.website || "");
  const [visibility, setVisibility] = useState(
    initialValue?.visibility || "public",
  );
  const [initialTeams, setInitialTeams] = useState("");

  const [schedule, setSchedule] = useState(
    initialValue?.schedule || DEFAULT_SCHEDULE,
  );
  const [venue, setVenue] = useState(initialValue?.venue || DEFAULT_VENUE);
  const [participation, setParticipation] = useState(
    initialValue?.participation || DEFAULT_PARTICIPATION,
  );
  const [categories, setCategories] = useState(
    initialValue?.categories || DEFAULT_CATEGORIES,
  );
  const [fees, setFees] = useState(initialValue?.fees || DEFAULT_FEES);
  const [awards, setAwards] = useState(initialValue?.awards || DEFAULT_AWARDS);
  const [automation, setAutomation] = useState(
    initialValue?.automation || DEFAULT_AUTOMATION,
  );
  const [sportFields, setSportFields] = useState(
    initialValue?.sportFields || DEFAULT_SPORT,
  );
  const [danceFields, setDanceFields] = useState(
    initialValue?.danceFields || DEFAULT_DANCE,
  );
  const [workshopFields, setWorkshopFields] = useState(
    initialValue?.workshopFields || DEFAULT_WORKSHOP,
  );
  const [performanceFields, setPerformanceFields] = useState(
    initialValue?.performanceFields || DEFAULT_PERFORMANCE,
  );

  const [stagedOfficials, setStagedOfficials] = useState<StagedOfficial[]>([]);
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [bannerFile, setBannerFile] = useState<File | undefined>();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formTab, setFormTab] = useState(0);

  const activityCategory = resolveActivityCategory(eventType, activity);
  const sections = getSectionsForEventType(eventType);
  const hasTypeFields =
    sections.includes("sportFields") ||
    sections.includes("danceFields") ||
    sections.includes("workshopFields") ||
    sections.includes("performanceFields");

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!eventType) errs.eventType = "Event type is required";
    if (!activity.trim()) errs.activity = "Activity is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setFormTab(0);
      return;
    }
    const payload: EventFormPayload = {
      name: name.trim(),
      eventType,
      activity: activity.trim(),
      format,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      entryFee: fees.entryFee,
      description: description || undefined,
      organizerName: organizerName || undefined,
      contactPerson: contactPerson || undefined,
      mobileNumber: mobileNumber || undefined,
      email: email || undefined,
      website: website || undefined,
      schedule,
      venue,
      participation,
      categories,
      fees,
      awards,
      automation,
      visibility,
    };
    if (sections.includes("sportFields")) payload.sportFields = sportFields;
    if (sections.includes("danceFields")) payload.danceFields = danceFields;
    if (sections.includes("workshopFields"))
      payload.workshopFields = workshopFields;
    if (sections.includes("performanceFields"))
      payload.performanceFields = performanceFields;
    if (mode === "create" && initialTeams.trim()) {
      payload.teams = initialTeams
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    await onSubmit(
      payload,
      { coverImage: coverFile, bannerImage: bannerFile },
      stagedOfficials,
    );
  };

  return (
    <div className="border-2 border-black bg-white flex flex-col">
      {}
      <div className="flex border-b-2 border-black overflow-x-auto">
        {EVENT_FORM_TABS.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFormTab(idx)}
            className={cn(
              "flex-1 py-3 px-2 text-xs font-bold uppercase tracking-wider transition-colors border-r-2 border-black last:border-r-0 whitespace-nowrap",
              formTab === idx
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#024BAB]/5",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5",
                formTab === idx
                  ? "bg-white text-[#024BAB]"
                  : "bg-black/10 text-black",
              )}
            >
              {idx + 1}
            </span>
            {tab}
          </button>
        ))}
      </div>

      {}
      <div className="p-6">
        {formTab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>
                <Type className="w-3.5 h-3.5 text-[#024BAB]" />
                Event Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Summer Football Cup"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <EventTypePicker
                value={eventType}
                onChange={(v: EventTypeKey) => setEventType(v)}
              />
              {errors.eventType && (
                <p className="text-xs text-red-600 mt-1">{errors.eventType}</p>
              )}
            </div>
            <div>
              <ActivityPicker
                value={activity}
                onChange={setActivity}
                activityCategory={activityCategory}
                required
              />
              {errors.activity && (
                <p className="text-xs text-red-600 mt-1">{errors.activity}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                <Eye className="w-3.5 h-3.5 text-[#024BAB]" />
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className={inputClass}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="invite_only">Invite Only</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>
                <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                rows={3}
              />
            </div>
          </div>
        )}

        {formTab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                <User className="w-3.5 h-3.5 text-[#024BAB]" />
                Organizer Name
              </label>
              <input
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <User className="w-3.5 h-3.5 text-[#024BAB]" />
                Contact Person
              </label>
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <Phone className="w-3.5 h-3.5 text-[#024BAB]" />
                Mobile Number
              </label>
              <input
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <Mail className="w-3.5 h-3.5 text-[#024BAB]" />
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <Globe className="w-3.5 h-3.5 text-[#024BAB]" />
                Website
              </label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputClass}
              />
            </div>
            {mode === "create" && (
              <div>
                <label className={labelClass}>
                  <Users className="w-3.5 h-3.5 text-[#024BAB]" />
                  Initial Teams (comma-separated)
                </label>
                <input
                  value={initialTeams}
                  onChange={(e) => setInitialTeams(e.target.value)}
                  className={inputClass}
                  placeholder="Team A, Team B"
                />
              </div>
            )}
            <FileUpload
              label="Cover Image"
              isImage
              previewUrl={initialValue?.coverImageUrl}
              onFileSelected={setCoverFile}
            />
            <FileUpload
              label="Banner Image"
              isImage
              previewUrl={initialValue?.bannerImageUrl}
              onFileSelected={setBannerFile}
            />
          </div>
        )}

        {formTab === 2 && (
          <div className="space-y-4">
            <VenueSection
              value={venue}
              onChange={(p) => setVenue((v) => ({ ...v, ...p }))}
            />
            <ScheduleSection
              value={schedule}
              onChange={(p) => setSchedule((s) => ({ ...s, ...p }))}
              startDate={startDate}
              endDate={endDate}
              onDatesChange={(p) => {
                if (p.startDate !== undefined) setStartDate(p.startDate);
                if (p.endDate !== undefined) setEndDate(p.endDate);
              }}
            />
          </div>
        )}

        {formTab === 3 && (
          <div className="space-y-4">
            <ParticipationSection
              value={participation}
              onChange={(p) => setParticipation((v) => ({ ...v, ...p }))}
            />
            <CategoriesSection
              value={categories}
              onChange={(p) => setCategories((v) => ({ ...v, ...p }))}
            />
            <FeesSection
              value={fees}
              onChange={(p) => setFees((v) => ({ ...v, ...p }))}
            />
          </div>
        )}

        {formTab === 4 && (
          <div className="space-y-4">
            <AwardsSection
              value={awards}
              onChange={(p) => setAwards((v) => ({ ...v, ...p }))}
            />
            {mode === "create" ? (
              <OfficialsSection
                value={stagedOfficials}
                onAdd={(o) => setStagedOfficials((prev) => [...prev, o])}
                onRemove={(i) =>
                  setStagedOfficials((prev) =>
                    prev.filter((_, idx) => idx !== i),
                  )
                }
              />
            ) : (
              <div className="border-2 border-black bg-white p-4 text-xs text-muted-foreground">
                Manage officials/judges from the{" "}
                <span className="font-bold text-black">Judges</span> tab on this
                event.
              </div>
            )}
            <AutomationSection
              value={automation}
              onChange={(p) => setAutomation((v) => ({ ...v, ...p }))}
            />
          </div>
        )}

        {formTab === 5 && (
          <div className="space-y-4">
            {sections.includes("sportFields") && (
              <SportFieldsSection
                value={sportFields}
                onChange={(p) => setSportFields((v) => ({ ...v, ...p }))}
                format={format}
                onFormatChange={setFormat}
              />
            )}
            {sections.includes("danceFields") && (
              <DanceFieldsSection
                value={danceFields}
                onChange={(p) => setDanceFields((v) => ({ ...v, ...p }))}
              />
            )}
            {sections.includes("workshopFields") && (
              <WorkshopFieldsSection
                value={workshopFields}
                onChange={(p) => setWorkshopFields((v) => ({ ...v, ...p }))}
              />
            )}
            {sections.includes("performanceFields") && (
              <PerformanceFieldsSection
                value={performanceFields}
                onChange={(p) => setPerformanceFields((v) => ({ ...v, ...p }))}
              />
            )}
            {!hasTypeFields && (
              <p className="text-sm text-muted-foreground">
                No additional fields for this event type.
              </p>
            )}
          </div>
        )}
      </div>

      {}
      <div className="flex items-center justify-between px-6 py-4 border-t-2 border-black bg-[#F8FAFF]">
        {formTab === 0 ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFormTab((t) => Math.max(0, t - 1))}
            className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
        )}

        <div className="flex gap-1.5">
          {EVENT_FORM_TABS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setFormTab(idx)}
              className={cn(
                "h-2 rounded-full border border-black transition-all",
                formTab === idx ? "bg-[#024BAB] w-6" : "bg-white w-2",
              )}
            />
          ))}
        </div>

        {formTab < EVENT_FORM_TABS.length - 1 ? (
          <button
            type="button"
            onClick={() =>
              setFormTab((t) => Math.min(EVENT_FORM_TABS.length - 1, t + 1))
            }
            className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A]"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-6 py-2 text-sm font-bold hover:bg-[#01368A] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "create" ? (
              "Create Event"
            ) : (
              "Save Changes"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
