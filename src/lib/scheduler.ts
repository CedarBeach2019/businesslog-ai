interface Event { id:string; title:string; description:string; start:number; end:number; allDay:boolean; location:string; attendees:string[]; reminders:number[]; recurrence?:{freq:'daily'|'weekly'|'monthly';interval:number;until?:number}; color:string; category:string }
const uid = () => crypto.randomUUID();
const dayMs = 86400000;

export class Scheduler {
  private events = new Map<string, Event>();
  
  create(d: Partial<Event>): Event { const e: Event = { id:uid(), title:d.title||'', description:d.description||'', start:d.start||Date.now(), end:d.end||Date.now()+3600000, allDay:d.allDay||false, location:d.location||'', attendees:d.attendees||[], reminders:d.reminders||[], recurrence:d.recurrence, color:d.color||'#4F46E5', category:d.category||'general' }; this.events.set(e.id, e); return e; }
  get(id: string): Event | undefined { return this.events.get(id); }
  update(id: string, d: Partial<Event>): Event | undefined { const e = this.events.get(id); if (!e) return; Object.assign(e, d); return e; }
  delete(id: string): void { this.events.delete(id); }
  
  forDay(date: number | string): Event[] {
    const d = typeof date === 'string' ? new Date(date).getTime() : date;
    const end = d + dayMs;
    return [...this.events.values()].filter(e => e.start >= d && e.start < end).sort((a, b) => a.start - b.start);
  }
  forWeek(date: number | string): Event[] {
    const d = typeof date === 'string' ? new Date(date).getTime() : date;
    const dow = new Date(d).getDay(); const mon = d - (dow === 0 ? 6 : dow - 1) * dayMs;
    return [...this.events.values()].filter(e => e.start >= mon && e.start < mon + 7 * dayMs);
  }
  forMonth(year: number, month: number): Event[] {
    const start = new Date(year, month, 1).getTime(); const end = new Date(year, month + 1, 1).getTime();
    return [...this.events.values()].filter(e => e.start >= start && e.start < end);
  }
  upcoming(hours: number): Event[] { const cutoff = Date.now() + hours * 3600000; return [...this.events.values()].filter(e => e.start >= Date.now() && e.start < cutoff).sort((a, b) => a.start - b.start); }
  conflicts(start: number, end: number): Event[] { return [...this.events.values()].filter(e => e.start < end && e.end > start && !e.allDay); }
  findFree(duration: number, date: number, afterHour = 9): number {
    for (let h = afterHour; h < 17; h++) {
      const slotStart = date + h * 3600000; const slotEnd = slotStart + duration * 60000;
      if (this.conflicts(slotStart, slotEnd).length === 0) return slotStart;
    }
    return -1;
  }
  setRecurrence(id: string, freq: Event['recurrence']['freq'], interval = 1, until?: number): void { const e = this.events.get(id); if (e) e.recurrence = { freq, interval, until }; }
  expandRecurrence(id: string, until: number): Event[] {
    const e = this.events.get(id); if (!e || !e.recurrence) return [e];
    const events = [e]; let next = e.start;
    const step = e.recurrence.freq === 'daily' ? dayMs : e.recurrence.freq === 'weekly' ? 7 * dayMs : 30 * dayMs;
    while ((next += step * e.recurrence.interval) <= until) {
      const dur = e.end - e.start;
      events.push({ ...e, id: uid(), start: next, end: next + dur, recurrence: undefined });
    }
    return events;
  }
  busyHours(date: number): Array<{start:number;end:number}> { return this.forDay(date).filter(e => !e.allDay).map(e => ({ start: e.start, end: e.end })); }
  availability(date: number, durationMin: number): number[] {
    const busy = this.busyHours(date); const slots: number[] = [];
    for (let h = 8; h < 18; h++) { const s = date + h * 3600000; if (!busy.some(b => s < b.end && s + durationMin * 60000 > b.start)) slots.push(s); }
    return slots;
  }
  search(query: string): Event[] { const q = query.toLowerCase(); return [...this.events.values()].filter(e => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)); }
  byCategory(cat: string): Event[] { return [...this.events.values()].filter(e => e.category === cat); }
  withAttendee(email: string): Event[] { return [...this.events.values()].filter(e => e.attendees.includes(email)); }
  serialize(): string { return JSON.stringify([...this.events.values()]); }
  deserialize(data: string): void { const d = JSON.parse(data); this.events = new Map(d.map((e: Event) => [e.id, e])); }
}
