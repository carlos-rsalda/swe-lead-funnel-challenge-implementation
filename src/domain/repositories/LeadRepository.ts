import { Lead } from '../entities/Lead';
import { PhoneNumber } from '../value-objects/PhoneNumber';

/**
 * Abstract repository for leads.
 *
 * `findByPhone` takes a `PhoneNumber` and not a string: the identity rule lives
 * in the domain, so an adapter receives a number that is already canonical and
 * only has to index it. It never has to decide which two leads are the same.
 *
 * `findByStage` gives no ordering guarantee. Occupancy is derived from it
 * (`findByStage().length`) because it is never stored.
 */
export interface LeadRepository {
  save(lead: Lead): Promise<void>;
  findByPhone(phone: PhoneNumber): Promise<Lead | null>;
  findByStage(stageId: string): Promise<Lead[]>;
}
