import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LoadingView,
  TextField,
  ImagePicker,
  StickyFooter,
  useToast,
  type PickedImage,
} from '../components/ui';
import { colors } from '../theme/colors';
import { eventAPI } from '../api/client';
import { eventTypes, getSectionsForEventType, type EventTypeKey } from '../config/eventTypeConfig';
import EventTypePicker from '../components/events/EventTypePicker';
import ActivityPicker from '../components/events/ActivityPicker';
import VenueSection, { VenueData } from '../components/events/sections/VenueSection';
import ScheduleSection, { ScheduleData } from '../components/events/sections/ScheduleSection';
import ParticipationSection, { ParticipationData } from '../components/events/sections/ParticipationSection';
import CategoriesSection, { CategoriesData } from '../components/events/sections/CategoriesSection';
import FeesSection, { FeesData } from '../components/events/sections/FeesSection';
import AwardsSection, { AwardsData } from '../components/events/sections/AwardsSection';
import OfficialsSection, { Official } from '../components/events/sections/OfficialsSection';
import AutomationSection, { AutomationData } from '../components/events/sections/AutomationSection';
import SportFieldsSection, { SportFieldsData } from '../components/events/sections/SportFieldsSection';
import DanceFieldsSection, { DanceFieldsData } from '../components/events/sections/DanceFieldsSection';
import WorkshopFieldsSection, { WorkshopFieldsData } from '../components/events/sections/WorkshopFieldsSection';
import PerformanceFieldsSection, { PerformanceFieldsData } from '../components/events/sections/PerformanceFieldsSection';

export default function EventFormScreen({ route, navigation }: any) {
  const id: string | undefined = route.params?.id;
  const isEdit = !!id;
  const { toast } = useToast() as any;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<EventTypeKey>('tournament');
  const [activity, setActivity] = useState('');
  const [format, setFormat] = useState('knockout');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [initialTeams, setInitialTeams] = useState('');

  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [venue, setVenue] = useState<VenueData>({});
  const [participation, setParticipation] = useState<ParticipationData>({ type: 'team' });
  const [categories, setCategories] = useState<CategoriesData>({});
  const [entryFee, setEntryFee] = useState('');
  const [fees, setFees] = useState<FeesData>({ currency: 'INR' });
  const [awards, setAwards] = useState<AwardsData>({});
  const [officials, setOfficials] = useState<Official[]>([]);
  const [automation, setAutomation] = useState<AutomationData>({});
  const [sportFields, setSportFields] = useState<SportFieldsData>({});
  const [danceFields, setDanceFields] = useState<DanceFieldsData>({});
  const [workshopFields, setWorkshopFields] = useState<WorkshopFieldsData>({});
  const [performanceFields, setPerformanceFields] = useState<PerformanceFieldsData>({});

  const [coverImage, setCoverImage] = useState<PickedImage | undefined>();
  const [bannerImage, setBannerImage] = useState<PickedImage | undefined>();
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [bannerUrl, setBannerUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!isEdit) return;
    eventAPI
      .getOne(id)
      .then((r: any) => {
        const e = r.data;
        setName(e.name || '');
        setEventType(e.eventType || 'tournament');
        setActivity(e.activity || '');
        setFormat(e.format || 'knockout');
        setStartDate((e.startDate || '').slice(0, 10));
        setEndDate((e.endDate || '').slice(0, 10));
        setDescription(e.description || '');
        setOrganizerName(e.organizerName || '');
        setContactPerson(e.contactPerson || '');
        setMobileNumber(e.mobileNumber || '');
        setEmail(e.email || '');
        setWebsite(e.website || '');
        setSchedule(e.schedule || {});
        setVenue(e.venue || {});
        setParticipation(e.participation || { type: 'team' });
        setCategories(e.categories || {});
        setEntryFee(e.entryFee ? String(e.entryFee) : '');
        setFees(e.fees || { currency: 'INR' });
        setAwards(e.awards || {});
        setOfficials(e.officials || []);
        setAutomation(e.automation || {});
        setSportFields(e.sportFields || {});
        setDanceFields(e.danceFields || {});
        setWorkshopFields(e.workshopFields || {});
        setPerformanceFields(e.performanceFields || {});
        setCoverUrl(e.coverImageUrl);
        setBannerUrl(e.bannerImageUrl);
      })
      .catch((err: any) => toast.error(err?.message || 'Could not load event'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sections = getSectionsForEventType(eventType);

  const handleSubmit = async () => {
    if (!name.trim() || !activity.trim()) {
      toast.error('Name and Activity are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        eventType,
        activity: activity.trim(),
        format,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        entryFee: entryFee ? Number(entryFee) : 0,
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
        fees: { ...fees, entryFee: entryFee ? Number(entryFee) : 0 },
        awards,
        automation,
      };
      if (sections.includes('sportFields')) payload.sportFields = sportFields;
      if (sections.includes('danceFields')) payload.danceFields = danceFields;
      if (sections.includes('workshopFields')) payload.workshopFields = workshopFields;
      if (sections.includes('performanceFields')) payload.performanceFields = performanceFields;

      let eventId = id;
      if (isEdit) {
        await eventAPI.update(id, payload);
      } else {
        if (initialTeams.trim()) {
          payload.teams = initialTeams.split(',').map(t => t.trim()).filter(Boolean);
        }
        const res: any = await eventAPI.create(payload);
        eventId = res.data._id;
      }

      if (coverImage || bannerImage) {
        await eventAPI.uploadImages(eventId!, { coverImage, bannerImage });
      }

      toast.success(isEdit ? 'Event updated' : 'Event created');
      navigation.replace('EventDetail', { id: eventId });
    } catch (e: any) {
      toast.error(e?.message || 'Could not save event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <TextField label="Event Name" value={name} onChangeText={setName} placeholder="e.g. Summer Football Cup" required />
        <EventTypePicker value={eventType} onChange={setEventType} />
        <ActivityPicker
          activityCategory={eventTypes[eventType]?.category || null}
          value={activity}
          onChange={setActivity}
        />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
        <TextField label="Organizer Name" value={organizerName} onChangeText={setOrganizerName} />
        <TextField label="Contact Person" value={contactPerson} onChangeText={setContactPerson} />
        <TextField label="Mobile Number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="Website" value={website} onChangeText={setWebsite} />
        {!isEdit && (
          <TextField
            label="Initial Teams (comma-separated)"
            value={initialTeams}
            onChangeText={setInitialTeams}
            placeholder="Team A, Team B"
          />
        )}
        <ImagePicker label="Cover Image" value={coverImage} previewUrl={coverUrl} onChange={setCoverImage} />
        <ImagePicker label="Banner Image" value={bannerImage} previewUrl={bannerUrl} onChange={setBannerImage} />

        <VenueSection value={venue} onChange={setVenue} />
        <ScheduleSection
          value={schedule}
          onChange={setSchedule}
          startDate={startDate}
          endDate={endDate}
          onChangeStartDate={setStartDate}
          onChangeEndDate={setEndDate}
        />
        <ParticipationSection value={participation} onChange={setParticipation} />
        <CategoriesSection value={categories} onChange={setCategories} />
        <FeesSection entryFee={entryFee} onChangeEntryFee={setEntryFee} value={fees} onChange={setFees} />
        <AwardsSection value={awards} onChange={setAwards} />
        <OfficialsSection eventId={id} officials={officials} onChanged={setOfficials} />
        <AutomationSection value={automation} onChange={setAutomation} />

        {sections.includes('sportFields') && (
          <SportFieldsSection format={format} onChangeFormat={setFormat} value={sportFields} onChange={setSportFields} />
        )}
        {sections.includes('danceFields') && <DanceFieldsSection value={danceFields} onChange={setDanceFields} />}
        {sections.includes('workshopFields') && <WorkshopFieldsSection value={workshopFields} onChange={setWorkshopFields} />}
        {sections.includes('performanceFields') && (
          <PerformanceFieldsSection value={performanceFields} onChange={setPerformanceFields} />
        )}
      </ScrollView>
      <StickyFooter
        onSave={handleSubmit}
        onCancel={() => navigation.goBack()}
        saveLabel={isEdit ? 'Save Changes' : 'Create Event'}
        saving={saving}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
});
