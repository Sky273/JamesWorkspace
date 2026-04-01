const CALENDAR_TIME_ZONE = 'Europe/Paris';
const CALENDAR_OPERATION_TIMEOUT_MS = Number.parseInt(process.env.CALENDAR_OPERATION_TIMEOUT_MS || '15000', 10);

function normalizeCalendarAttendees(attendees = []) {
    return attendees
        .filter(attendee => attendee?.email)
        .map(attendee => ({
            email: attendee.email,
            displayName: attendee.name || undefined
        }));
}

export function withCalendarTimeout(operationPromise, operationName) {
    return Promise.race([
        operationPromise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${operationName} timed out after ${CALENDAR_OPERATION_TIMEOUT_MS}ms`));
            }, CALENDAR_OPERATION_TIMEOUT_MS);
        })
    ]);
}

export function buildCalendarEventPayload(interview = {}) {
    const startTime = new Date(interview.scheduledAt);
    const endTime = new Date(startTime.getTime() + (interview.durationMinutes || 60) * 60 * 1000);

    const event = {
        summary: interview.title,
        description: interview.description || '',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: CALENDAR_TIME_ZONE
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: CALENDAR_TIME_ZONE
        },
        location: interview.location || '',
        attendees: normalizeCalendarAttendees(interview.attendees),
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 }
            ]
        }
    };

    if (interview.meetingLink && interview.meetingLink.includes('meet.google.com')) {
        event.conferenceData = {
            entryPoints: [{
                entryPointType: 'video',
                uri: interview.meetingLink
            }]
        };
    }

    return event;
}

export function buildCalendarEventPatch(updates = {}) {
    const event = {};

    if (updates.title) event.summary = updates.title;
    if (updates.description) event.description = updates.description;
    if (updates.location) event.location = updates.location;

    if (updates.scheduledAt) {
        const startTime = new Date(updates.scheduledAt);
        const endTime = new Date(startTime.getTime() + (updates.durationMinutes || 60) * 60 * 1000);
        event.start = { dateTime: startTime.toISOString(), timeZone: CALENDAR_TIME_ZONE };
        event.end = { dateTime: endTime.toISOString(), timeZone: CALENDAR_TIME_ZONE };
    }

    if (updates.attendees) {
        event.attendees = normalizeCalendarAttendees(updates.attendees);
    }

    return event;
}

export function mapCalendarEventSummary(event = {}) {
    return {
        eventId: event.id,
        htmlLink: event.htmlLink,
        hangoutLink: event.hangoutLink
    };
}

export function mapUpcomingCalendarEvent(event = {}) {
    return {
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        htmlLink: event.htmlLink,
        hangoutLink: event.hangoutLink,
        attendees: event.attendees
    };
}

export function extractCalendarErrorDetails(error) {
    return {
        error: error?.message || 'Unknown calendar error',
        code: error?.code || null,
        status: error?.response?.status || null
    };
}
