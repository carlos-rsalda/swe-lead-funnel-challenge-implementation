import { Funnel } from '../../domain/entities/Funnel';
import { LeadRepository } from '../../domain/repositories/LeadRepository';

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
 */
export class MoveLeadToStage {
  constructor(
    private readonly repository: LeadRepository,
    private readonly funnel: Funnel
  ) {}

  async execute(data: MoveLeadToStageData): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
