import React from 'react';
import { Card, SectionTitle, Row, EmptyState } from '../../ui';
import { CalendarClock } from 'lucide-react-native';

function fmt(v?: string) {
  return v || '—';
}

export default function ScheduleTab({ event }: { event: any }) {
  const schedule = event.schedule || {};
  const venue = event.venue || {};
  const hasAny =
    event.startDate ||
    event.endDate ||
    Object.values(schedule).some(Boolean) ||
    Object.values(venue).some(Boolean);

  if (!hasAny) {
    return (
      <Card>
        <EmptyState
          title="No schedule set"
          sub="Edit this event to add dates, times and venue"
          icon={CalendarClock}
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <SectionTitle title="Dates & Times" />
        <Row title="Start Date" subtitle={fmt(event.startDate)} noBorder />
        <Row title="End Date" subtitle={fmt(event.endDate)} noBorder />
        <Row title="Event Date" subtitle={fmt(schedule.eventDate)} noBorder />
        <Row title="Start Time" subtitle={fmt(schedule.startTime)} noBorder />
        <Row title="End Time" subtitle={fmt(schedule.endTime)} noBorder />
        <Row title="Check-in Time" subtitle={fmt(schedule.checkInTime)} noBorder />
        <Row
          title="Registration Opens"
          subtitle={fmt(schedule.registrationOpensAt)}
          noBorder
        />
        <Row
          title="Registration Closes"
          subtitle={fmt(schedule.registrationClosesAt)}
          noBorder
        />
        <Row
          title="Opening Ceremony"
          subtitle={fmt(schedule.openingCeremonyTime)}
          noBorder
        />
        <Row
          title="Closing Ceremony"
          subtitle={fmt(schedule.closingCeremonyTime)}
          noBorder
        />
      </Card>
      <Card>
        <SectionTitle title="Venue" />
        <Row title="Name" subtitle={fmt(venue.name)} noBorder />
        <Row
          title="Hall / Ground / Court / Stage"
          subtitle={fmt(venue.hallGroundCourtStage)}
          noBorder
        />
        <Row title="Address" subtitle={fmt(venue.address)} noBorder />
        <Row
          title="City / State"
          subtitle={`${fmt(venue.city)}, ${fmt(venue.state)}`}
          noBorder
        />
      </Card>
    </>
  );
}
