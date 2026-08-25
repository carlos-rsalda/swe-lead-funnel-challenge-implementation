import { Lead } from '../../src/domain/entities/Lead';
import { LeadRepository } from '../../src/domain/repositories/LeadRepository';
import { PhoneNumber } from '../../src/domain/value-objects/PhoneNumber';

/**
 * Test double for the `LeadRepository` port.
 *
 * It is a fake, not a mock: it really stores leads, so a use case test can
 * assert on outcomes instead of on interactions. It also records every call,
 * because two decisions in MAP.md are about what the use case must *not* ask:
 *
 *   MAP.md §4 — "misma etapa + llena -> InvalidStageTransitionError. La peticion
 *   es incoherente en si misma; la ocupacion ni se consulta."
 *
 * Two deliberate details:
 *
 * 1. It stores live references, exactly like `InMemoryLeadRepository` does
 *    (MAP.md §5). A test can therefore hold the same `Lead` instance the use
 *    case mutates, which is what makes the aliasing test meaningful.
 *
 * 2. It never canonicalises the key it is given. MAP.md §1 puts the identity
 *    rule in `PhoneNumber` so that it "no se filtra a infraestructura": the
 *    repository indexes the canonical string it receives, it does not compute
 *    it. If the use case looked leads up by the raw input instead of by the
 *    canonical form, this fake would miss the duplicate — which is the point.
 */
export class FakeLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  readonly saved: Lead[] = [];
  readonly findByPhoneCalls: string[] = [];
  readonly findByStageCalls: string[] = [];

  /** Seeds state without going through `save`, so `saved` stays a clean log. */
  static seededWith(...leads: Lead[]): FakeLeadRepository {
    const repository = new FakeLeadRepository();
    for (const lead of leads) {
      repository.leads.set(lead.phone.value, lead);
    }
    return repository;
  }

  async save(lead: Lead): Promise<void> {
    this.saved.push(lead);
    this.leads.set(lead.phone.value, lead);
  }

  async findByPhone(phone: PhoneNumber): Promise<Lead | null> {
    this.findByPhoneCalls.push(phone.value);
    return this.leads.get(phone.value) ?? null;
  }

  async findByStage(stageId: string): Promise<Lead[]> {
    this.findByStageCalls.push(stageId);
    return [...this.leads.values()].filter((lead) => lead.isAt(stageId));
  }
}
