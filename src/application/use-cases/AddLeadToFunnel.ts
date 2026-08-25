import { Funnel } from '../../domain/entities/Funnel';
import { Lead } from '../../domain/entities/Lead';
import { DuplicateLeadError } from '../../domain/errors/DuplicateLeadError';
import { StageCapacityExceededError } from '../../domain/errors/StageCapacityExceededError';
import { LeadRepository } from '../../domain/repositories/LeadRepository';
import { PhoneNumber } from '../../domain/value-objects/PhoneNumber';

export interface AddLeadToFunnelData {
  phone: string;
  name: string;
}

/**
 * Use case: add a new lead to the funnel.
 *
 * Rules:
 * - No lead with the same phone number may already exist in the funnel.
 * - New leads always enter the funnel's first stage.
 * - The first stage must have capacity available.
 *
 * The checks run from what depends only on the request to what depends on the
 * state of the world, so the errors that survive a retry are raised first:
 *
 *   valid input -> already exists -> room in the first stage -> save
 *
 * A duplicate therefore settles the request before the occupancy is ever asked
 * for: the duplicate is permanent, the lack of room is transient.
 */
export class AddLeadToFunnel {
  constructor(
    private readonly repository: LeadRepository,
    private readonly funnel: Funnel
  ) {}

  async execute(data: AddLeadToFunnelData): Promise<void> {
    const phone = new PhoneNumber(data.phone);
    const firstStageId = this.funnel.firstStageId();
    const lead = new Lead(phone, data.name, firstStageId);

    const existing = await this.repository.findByPhone(phone);
    if (existing !== null) {
      throw new DuplicateLeadError(phone.value);
    }

    const occupancy = await this.repository.findByStage(firstStageId);
    if (!this.funnel.canAcceptOneMore(firstStageId, occupancy.length)) {
      throw new StageCapacityExceededError(firstStageId);
    }

    await this.repository.save(lead);
  }
}
