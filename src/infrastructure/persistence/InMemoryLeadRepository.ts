import { Lead } from '../../domain/entities/Lead';
import { LeadRepository } from '../../domain/repositories/LeadRepository';
import { PhoneNumber } from '../../domain/value-objects/PhoneNumber';

/**
 * In-memory implementation of the LeadRepository.
 *
 * Leads are indexed by the canonical string of their phone number, so `save` is
 * an upsert by identity: saving a lead whose number is already held replaces it.
 * The adapter never canonicalises anything itself — it is handed a `PhoneNumber`
 * that already is canonical.
 *
 * Leads are stored by reference, not copied. A caller that mutates a lead this
 * repository handed out changes what the repository holds, without calling
 * `save`. That is a property of an in-memory store and the use cases are written
 * for it: they only mutate once every check has passed.
 */
export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  async save(lead: Lead): Promise<void> {
    this.leads.set(lead.phone.value, lead);
  }

  async findByPhone(phone: PhoneNumber): Promise<Lead | null> {
    return this.leads.get(phone.value) ?? null;
  }

  async findByStage(stageId: string): Promise<Lead[]> {
    return [...this.leads.values()].filter((lead) => lead.isAt(stageId));
  }
}
