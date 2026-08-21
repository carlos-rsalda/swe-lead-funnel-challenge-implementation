import { Lead } from '../entities/Lead';

/**
 * Abstract repository for leads.
 *
 * TODO: adjust or extend this interface if your use cases need it.
 */
export interface LeadRepository {
  save(lead: Lead): Promise<void>;
  findByPhone(phone: string): Promise<Lead | null>;
  findByStage(stageId: string): Promise<Lead[]>;
}
