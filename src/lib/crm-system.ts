interface Note { id:string; content:string; created:string; author:string }
interface Contact { id:string; name:string; email:string; phone:string; company:string; role:string; tags:string[]; notes:Note[]; created:string; lastContact:string; value:number }
interface Company { id:string; name:string; industry:string; size:string; website:string; contactIds:string[]; notes:Note[] }
interface Deal { id:string; title:string; companyId:string; contactId:string; value:number; stage:'lead'|'qualified'|'proposal'|'negotiation'|'closed-won'|'closed-lost'; probability:number; expectedClose:string; notes:Note[] }
const uid = () => crypto.randomUUID();
const stages = ['lead','qualified','proposal','negotiation','closed-won','closed-lost'] as const;
const stageProb = { lead: 0.1, qualified: 0.25, proposal: 0.5, negotiation: 0.75, 'closed-won': 1, 'closed-lost': 0 };
export class CRMSystem {
  private contacts = new Map<string, Contact>();
  private companies = new Map<string, Company>();
  private deals = new Map<string, Deal>();
  addContact(data: Partial<Contact>): Contact { const c: Contact = { id: uid(), name: data.name || '', email: data.email || '', phone: data.phone || '', company: data.company || '', role: data.role || '', tags: data.tags || [], notes: [], created: new Date().toISOString(), lastContact: new Date().toISOString(), value: data.value || 0 }; this.contacts.set(c.id, c); return c; }
  updateContact(id: string, data: Partial<Contact>): Contact | undefined { const c = this.contacts.get(id); if (!c) return; Object.assign(c, data); return c; }
  searchContacts(q: string): Contact[] { const l = q.toLowerCase(); return [...this.contacts.values()].filter(c => c.name.toLowerCase().includes(l) || c.email.toLowerCase().includes(l) || c.company.toLowerCase().includes(l) || c.tags.some(t => t.includes(l))); }
  getByCompany(cid: string): Contact[] { return [...this.contacts.values()].filter(c => c.company === cid); }
  addCompany(data: Partial<Company>): Company { const c: Company = { id: uid(), name: data.name || '', industry: data.industry || '', size: data.size || '', website: data.website || '', contactIds: [], notes: [] }; this.companies.set(c.id, c); return c; }
  addToCompany(contactId: string, companyId: string): void { const c = this.companies.get(companyId); if (c && !c.contactIds.includes(contactId)) c.contactIds.push(contactId); const ct = this.contacts.get(contactId); if (ct) ct.company = c.name; }
  searchCompanies(q: string): Company[] { const l = q.toLowerCase(); return [...this.companies.values()].filter(c => c.name.toLowerCase().includes(l) || c.industry.toLowerCase().includes(l)); }
  createDeal(data: Partial<Deal>): Deal { const d: Deal = { id: uid(), title: data.title || '', companyId: data.companyId || '', contactId: data.contactId || '', value: data.value || 0, stage: 'lead', probability: 0.1, expectedClose: data.expectedClose || '', notes: [] }; this.deals.set(d.id, d); return d; }
  moveDeal(id: string, stage: Deal['stage']): Deal | undefined { const d = this.deals.get(id); if (!d) return; d.stage = stage; d.probability = stageProb[stage]; if (stage === 'closed-won' || stage === 'closed-lost') { const ct = this.contacts.get(d.contactId); if (ct) { ct.lastContact = new Date().toISOString(); if (stage === 'closed-won') ct.value += d.value; } } return d; }
  getByStage(stage: string): Deal[] { return [...this.deals.values()].filter(d => d.stage === stage); }
  getPipeline(): Array<{stage: string; deals: Deal[]; total: number}> { return stages.map(s => ({ stage: s, deals: this.getByStage(s), total: this.getByStage(s).reduce((t, d) => t + d.value, 0) })); }
  getWon(months = 6): Deal[] { const cutoff = Date.now() - months * 30 * 86400000; return [...this.deals.values()].filter(d => d.stage === 'closed-won' && new Date(d.expectedClose).getTime() >= cutoff); }
  getLost(months = 6): Deal[] { const cutoff = Date.now() - months * 30 * 86400000; return [...this.deals.values()].filter(d => d.stage === 'closed-lost' && new Date(d.expectedClose).getTime() >= cutoff); }
  addNote(contactId: string, content: string, author = 'user'): void { const c = this.contacts.get(contactId); if (c) c.notes.push({ id: uid(), content, created: new Date().toISOString(), author }); }
  getNotes(contactId: string): Note[] { return this.contacts.get(contactId)?.notes || []; }
  companyRevenue(cid: string): number { const co = this.companies.get(cid); if (!co) return 0; return this.getWon().filter(d => co.contactIds.includes(d.contactId)).reduce((s, d) => s + d.value, 0); }
  topContacts(n = 5): Contact[] { return [...this.contacts.values()].sort((a, b) => b.value - a.value).slice(0, n); }
  forecast(): number { return [...this.deals.values()].filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost').reduce((s, d) => s + d.value * d.probability, 0); }
  serialize(): string { return JSON.stringify({ contacts: [...this.contacts.values()], companies: [...this.companies.values()], deals: [...this.deals.values()] }); }
  deserialize(data: string): void { const d = JSON.parse(data); this.contacts = new Map(d.contacts.map((c: Contact) => [c.id, c])); this.companies = new Map(d.companies.map((c: Company) => [c.id, c])); this.deals = new Map(d.deals.map((d: Deal) => [d.id, d])); }
}
