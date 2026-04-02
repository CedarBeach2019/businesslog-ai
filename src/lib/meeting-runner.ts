export interface TranscriptEntry {
  speaker: string;
  text: string;
  ts: number;
  type: 'statement' | 'question' | 'idea' | 'action' | 'objection' | 'agreement';
}

export interface ActionItem {
  id: string;
  text: string;
  assignee: string;
  dueDate?: number;
  status: 'pending' | 'in-progress' | 'done';
  spawnedResearchId?: string;
}

export interface MeetingParticipant {
  id: string;
  name: string;
  twinId?: string;
  role: 'host' | 'attendee' | 'observer';
  isHuman: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  participants: MeetingParticipant[];
  agenda: string[];
  status: 'scheduled' | 'active' | 'paused' | 'completed';
  transcript: TranscriptEntry[];
  actions: ActionItem[];
  startedAt?: number;
  endedAt?: number;
  duration?: number;
}

interface BufferedIdea {
  id: string;
  participantId: string;
  idea: string;
  confidence: number;
  shared: boolean;
}

export class MeetingRunner {
  private meetings: Map<string, Meeting> = new Map();
  private ideaBuffer: Map<string, BufferedIdea[]> = new Map();

  createMeeting(title: string, participants: MeetingParticipant[], agenda: string[]): Meeting {
    const id = `meet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const meeting: Meeting = {
      id, title, participants, agenda,
      status: 'scheduled', transcript: [], actions: []
    };
    this.meetings.set(id, meeting);
    this.ideaBuffer.set(id, []);
    return meeting;
  }

  getMeeting(id: string): Meeting {
    const m = this.meetings.get(id);
    if (!m) throw new Error(`Meeting not found: ${id}`);
    return m;
  }

  startMeeting(id: string): void {
    const m = this.getMeeting(id);
    if (m.status !== 'scheduled' && m.status !== 'paused') {
      throw new Error(`Cannot start meeting in state: ${m.status}`);
    }
    if (!m.startedAt) m.startedAt = Date.now();
    m.status = 'active';
  }

  addTranscriptEntry(meetingId: string, speaker: string, text: string, type: TranscriptEntry['type']): void {
    const m = this.getMeeting(meetingId);
    if (m.status !== 'active') throw new Error('Meeting is not active');
    m.transcript.push({ speaker, text, ts: Date.now(), type });
  }

  addActionItem(meetingId: string, text: string, assignee: string): ActionItem {
    const m = this.getMeeting(meetingId);
    const action: ActionItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text, assignee, status: 'pending'
    };
    m.actions.push(action);
    return action;
  }

  spawnResearchAgent(meetingId: string, actionItemId: string, idea: string): string {
    const m = this.getMeeting(meetingId);
    const action = m.actions.find(a => a.id === actionItemId);
    if (!action) throw new Error(`Action item not found: ${actionItemId}`);
    
    const researchId = `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    action.spawnedResearchId = researchId;
    action.status = 'in-progress';
    
    this.addTranscriptEntry(meetingId, 'System', 
      `Research agent spawned to investigate: "${idea}" (ID: ${researchId})`, 'action');
    
    return researchId;
  }

  getActiveMeeting(): Meeting | undefined {
    for (const m of this.meetings.values()) {
      if (m.status === 'active') return m;
    }
    return undefined;
  }

  pauseMeeting(id: string): void {
    const m = this.getMeeting(id);
    if (m.status !== 'active') throw new Error('Meeting is not active');
    m.status = 'paused';
  }

  resumeMeeting(id: string): void {
    const m = this.getMeeting(id);
    if (m.status !== 'paused') throw new Error('Meeting is not paused');
    m.status = 'active';
  }

  endMeeting(id: string): { duration: number; summary: string; actionItems: ActionItem[]; highlights: string[] } {
    const m = this.getMeeting(id);
    m.endedAt = Date.now();
    m.duration = m.endedAt - (m.startedAt || m.endedAt);
    m.status = 'completed';
    
    return {
      duration: m.duration,
      summary: this.getMeetingSummary(id),
      actionItems: m.actions,
      highlights: this.getHighlights(id)
    };
  }

  getMeetingSummary(id: string): string {
    const m = this.getMeeting(id);
    const speakers = [...new Set(m.transcript.map(t => t.speaker))];
    const ideas = m.transcript.filter(t => t.type === 'idea');
    const questions = m.transcript.filter(t => t.type === 'question');
    const objections = m.transcript.filter(t => t.type === 'objection');
    
    let summary = `Meeting: ${m.title}\n`;
    summary += `Participants: ${speakers.join(', ')}\n`;
    summary += `Duration: ${m.duration ? Math.round(m.duration / 60000) : 0} minutes\n`;
    summary += `Transcript entries: ${m.transcript.length}\n`;
    summary += `Ideas generated: ${ideas.length}, Questions raised: ${questions.length}, Objections: ${objections.length}\n`;
    
    if (m.actions.length > 0) {
      summary += `Action Items (${m.actions.length}):\n`;
      m.actions.forEach(a => summary += `  - [${a.status.toUpperCase()}] ${a.text} (${a.assignee})\n`);
    }
    
    summary += `\nKey Discussion Points:\n`;
    m.transcript.filter(t => t.type === 'idea' || t.type === 'action').forEach(t => {
      summary += `  [${t.speaker}] ${t.text}\n`;
    });
    
    return summary;
  }

  getHighlights(id: string): string[] {
    const m = this.getMeeting(id);
    const highlights: string[] = [];
    
    m.transcript.filter(t => t.type === 'idea').forEach(t => {
      highlights.push(`💡 Idea from ${t.speaker}: ${t.text}`);
    });
    
    m.transcript.filter(t => t.type === 'objection').forEach(t => {
      highlights.push(`⚠️ Objection by ${t.speaker}: ${t.text}`);
    });
    
    m.actions.forEach(a => {
      highlights.push(`📋 Action: ${a.text} → ${a.assignee}`);
    });
    
    m.transcript.filter(t => t.type === 'agreement').forEach(t => {
      highlights.push(`🤝 Agreement: ${t.text}`);
    });
    
    return highlights;
  }

  bufferIdea(meetingId: string, participantId: string, idea: string, confidence: number): void {
    const m = this.getMeeting(meetingId);
    const participant = m.participants.find(p => p.id === participantId);
    if (!participant) throw new Error(`Participant not found: ${participantId}`);
    
    const buffer = this.ideaBuffer.get(meetingId) || [];
    buffer.push({
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      participantId, idea, confidence, shared: false
    });
    this.ideaBuffer.set(meetingId, buffer);
  }

  shareBufferedIdea(meetingId: string, ideaId: string): void {
    const m = this.getMeeting(meetingId);
    const buffer = this.ideaBuffer.get(meetingId);
    if (!buffer) throw new Error('No buffered ideas for meeting');
    
    const idea = buffer.find(i => i.id === ideaId);
    if (!idea || idea.shared) throw new Error(`Idea not found or already shared: ${ideaId}`);
    
    const participant = m.participants.find(p => p.id === idea.participantId);
    idea.shared = true;
    
    this.addTranscriptEntry(meetingId, participant?.name || 'Unknown',
      `${idea.idea} (confidence: ${Math.round(idea.confidence * 100)}%)`, 'idea');
  }

  getTranscript(id: string): TranscriptEntry[] {
    return this.getMeeting(id).transcript;
  }

  getActionItems(id: string): ActionItem[] {
    return this.getMeeting(id).actions;
  }

  simulateMeeting(title: string, agenda: string[], twinIds: string[]): Meeting {
    const participants: MeetingParticipant[] = twinIds.map((tid, i) => ({
      id: `sim_p${i}`, name: `Twin-${tid.slice(0, 6)}`, twinId: tid,
      role: i === 0 ? 'host' as const : 'attendee' as const, isHuman: false
    }));
    
    const meeting = this.createMeeting(title, participants, agenda);
    this.startMeeting(meeting.id);
    
    const perspectives = ['optimistic', 'analytical', 'cautious', 'creative'];
    const responses = [
      'I see strong potential in this approach.',
      'We should analyze the risks more carefully.',
      'This aligns well with our Q4 objectives.',
      'What if we pivot towards the emerging market segment?',
      'The ROI projections look conservative.',
      'We need more data before committing resources.',
      'I can prototype this by next sprint.',
      'The competitive landscape supports this initiative.',
      'Let\'s consider an incremental rollout strategy.',
      'Customer feedback validates this direction.'
    ];
    
    agenda.forEach((topic, tIdx) => {
      this.addTranscriptEntry(meeting.id, participants[0].name,
        `Moving to agenda item ${tIdx + 1}: ${topic}`, 'statement');
      
      participants.slice(1).forEach((p, pIdx) => {
        const rIdx = (tIdx * participants.length + pIdx) % responses.length;
        const type: TranscriptEntry['type'] = 
          [pIdx % 3 === 0 ? 'idea' : 'statement', 'agreement', 'question', 'objection'][Math.min(pIdx, 3)] as TranscriptEntry['type'];
        
        this.addTranscriptEntry(meeting.id, p.name, responses[rIdx], type);
      });
    });
    
    const actions = [
      { text: `Compile research on: ${agenda[0] || 'main topic'}`, assignee: participants[1]?.name || 'Twin' },
      { text: 'Draft implementation timeline', assignee: participants[0].name }
    ];
    
    actions.forEach(a => this.addActionItem(meeting.id, a.text, a.assignee));
    
    this.endMeeting(meeting.id);
    return meeting;
  }

  serialize(meeting: Meeting): string {
    return JSON.stringify(meeting, null, 2);
  }

  deserialize(json: string): Meeting {
    const meeting = JSON.parse(json) as Meeting;
    this.meetings.set(meeting.id, meeting);
    this.ideaBuffer.set(meeting.id, []);
    return meeting;
  }
}