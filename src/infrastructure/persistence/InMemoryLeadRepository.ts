import { Lead } from '../../domain/entities/Lead';
import { LeadRepository } from '../../domain/repositories/LeadRepository';

/**
 * In-memory implementation of the LeadRepository.
 */
export class InMemoryLeadRepository implements LeadRepository {
  async save(lead: Lead): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findByPhone(phone: string): Promise<Lead | null> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findByStage(stageId: string): Promise<Lead[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
