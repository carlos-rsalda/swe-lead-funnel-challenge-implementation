import { Funnel } from '../../domain/entities/Funnel';
import { InvalidStageTransitionError } from '../../domain/errors/InvalidStageTransitionError';
import { LeadNotFoundError } from '../../domain/errors/LeadNotFoundError';
import { StageCapacityExceededError } from '../../domain/errors/StageCapacityExceededError';
import { StageNotFoundError } from '../../domain/errors/StageNotFoundError';
import { LeadRepository } from '../../domain/repositories/LeadRepository';
import { PhoneNumber } from '../../domain/value-objects/PhoneNumber';

export interface MoveLeadToStageData {
  phone: string;
  targetStageId: string;
}

/**
 * Use case: move an existing lead to another stage of the funnel.
 *
 * Rules:
 * - The lead must exist in the funnel.
 * - The target stage must exist in the funnel.
 * - The target stage must have capacity available.
 * - Moving a lead to the stage it is already in is not a valid transition.
 *
 * The checks run from what depends only on the request to what depends on the
 * state of the world, so the errors that survive a retry are raised first:
 *
 *   valid input -> target exists -> lead exists -> target is not the current
 *   stage -> room in the target -> move and save
 *
 * The target stage is settled before the lead is looked up because the funnel is
 * fixed at construction: whether the stage exists is a pure function of the
 * request and an immutable configuration, while the lead's existence is not.
 *
 * `isAt` asks the question that decides which error the caller sees; `moveTo`
 * holds the same rule as an invariant. The lead is only mutated once every check
 * has passed, because the repository hands out live references and a mutation
 * would otherwise be visible without a save.
 */
export class MoveLeadToStage {
  constructor(
    private readonly repository: LeadRepository,
    private readonly funnel: Funnel
  ) {}

  async execute(data: MoveLeadToStageData): Promise<void> {
    const phone = new PhoneNumber(data.phone);
    const targetStageId = data.targetStageId;

    if (!this.funnel.hasStage(targetStageId)) {
      throw new StageNotFoundError(targetStageId);
    }

    const lead = await this.repository.findByPhone(phone);
    if (lead === null) {
      throw new LeadNotFoundError(phone.value);
    }

    if (lead.isAt(targetStageId)) {
      throw new InvalidStageTransitionError(
        `Cannot move lead ${phone.value} to stage ${targetStageId}: it is already there`
      );
    }

    const occupancy = await this.repository.findByStage(targetStageId);
    if (!this.funnel.canAcceptOneMore(targetStageId, occupancy.length)) {
      throw new StageCapacityExceededError(targetStageId);
    }

    lead.moveTo(targetStageId);
    await this.repository.save(lead);
  }
}
