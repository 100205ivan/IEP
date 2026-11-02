export const meetingTypes = ['期初會議', '期末檢討會議', '期末檢討暨下學期期初會議', '期末檢討暨轉銜會議', '轉銜會議', '其他'] as const
export const participantRoles = ['student', 'parent', 'administrator', 'general_teacher', 'special_education_teacher', 'professional', 'other'] as const
export const discussionTypes = ['學生能力與學習現況', 'IEP 教育目標執行成果', '特殊教育需求', '課程規劃', '相關服務及支持策略', '行為功能介入方案', '轉銜服務', '家長／學生意見', '其他'] as const

export type MeetingType = typeof meetingTypes[number]
export type ParticipantRole = typeof participantRoles[number]
export interface MeetingParticipant { id: string; role: ParticipantRole; name: string; title: string; attended: boolean }
export interface MeetingDiscussionTopic { id: string; type: typeof discussionTypes[number]; enabled: boolean; summary: string; otherName?: string }
export interface MeetingDecision { id: string; content: string }
export interface MeetingMotion { id: string; content: string }
export interface IepMeetingRecord { id: string; meetingType: MeetingType; otherMeetingType: string; date: string; location: string; chairperson: string; recorder: string; participants: MeetingParticipant[]; discussionTopics: MeetingDiscussionTopic[]; decisions: MeetingDecision[]; motions: MeetingMotion[]; hasMotions: boolean }

export function createMeetingTopics(): MeetingDiscussionTopic[] {
  return discussionTypes.map(type => ({ id: crypto.randomUUID(), type, enabled: false, summary: '', ...(type === '其他' ? { otherName: '' } : {}) }))
}

export function createEmptyMeeting(): IepMeetingRecord {
  return { id: crypto.randomUUID(), meetingType: '期初會議', otherMeetingType: '', date: '', location: '', chairperson: '', recorder: '', participants: [], discussionTopics: createMeetingTopics(), decisions: [], motions: [], hasMotions: false }
}
