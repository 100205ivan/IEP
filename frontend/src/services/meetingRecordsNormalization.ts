import { createMeetingTopics, discussionTypes, meetingTypes, participantRoles, type IepMeetingRecord, type MeetingDecision, type MeetingDiscussionTopic } from '../models/iepMeeting'

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function objects(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)) : [] }
function identifier(value: unknown): string { return text(value).trim() || crypto.randomUUID() }
function option<T extends string>(options: readonly T[], value: unknown, fallback: T): T { return options.includes(value as T) ? value as T : fallback }
function contentItems(value: unknown): MeetingDecision[] { return objects(value).map(item => ({ ...item, id: identifier(item.id), content: text(item.content) })) }

function topics(value: unknown): MeetingDiscussionTopic[] {
  const saved = objects(value).map(topic => {
    const type = option(discussionTypes, topic.type, '其他')
    return { ...topic, id: identifier(topic.id), type, enabled: topic.enabled === true, summary: text(topic.summary), ...(type === '其他' || 'otherName' in topic ? { otherName: text(topic.otherName) || (topic.type !== type ? text(topic.type) : '') } : {}) }
  })
  // Older records may contain only the topics that were discussed.
  return [...saved, ...createMeetingTopics().filter(topic => !saved.some(item => item.type === topic.type))]
}

export function normalizeMeetingRecords(value: unknown): IepMeetingRecord[] {
  return objects(value).map(meeting => ({
    ...meeting,
    id: identifier(meeting.id), meetingType: option(meetingTypes, meeting.meetingType, '期初會議'), otherMeetingType: text(meeting.otherMeetingType),
    date: text(meeting.date), location: text(meeting.location), chairperson: text(meeting.chairperson), recorder: text(meeting.recorder),
    participants: objects(meeting.participants).map(person => ({ ...person, id: identifier(person.id), role: option(participantRoles, person.role, 'other'), name: text(person.name), title: text(person.title), attended: typeof person.attended === 'boolean' ? person.attended : true })),
    discussionTopics: topics(meeting.discussionTopics), decisions: contentItems(meeting.decisions), motions: contentItems(meeting.motions), hasMotions: meeting.hasMotions === true,
  }))
}
