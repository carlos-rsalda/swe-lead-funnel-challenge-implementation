import { InvalidFunnelError } from '../errors/InvalidFunnelError';
import { StageNotFoundError } from '../errors/StageNotFoundError';

/**
 * A stage of a funnel.
 *
 * `capacity` is the maximum number of leads the stage can hold. Absent means no
 * limit; `0` means the stage is closed.
 */
export interface Stage {
  id: string;
  name: string;
  capacity?: number;
}

/**
 * Funnel entity.
 *
 * A funnel is an ordered list of stages, validated once at construction: a
 * funnel that exists is a funnel that is well formed.
 *
 * The stages are not exposed. The funnel answers questions about them instead
 * of handing out `capacity?: number`, so no caller can read an absent limit and
 * a zero limit as the same falsy value.
 */
export class Funnel {
  private readonly stages: Stage[];

  constructor(
    public readonly id: string,
    stages: Stage[]
  ) {
    if (stages.length === 0) {
      throw new InvalidFunnelError('a funnel needs at least one stage');
    }

    const seenIds = new Set<string>();
    for (const stage of stages) {
      if (stage.id.trim().length === 0) {
        throw new InvalidFunnelError('a stage id cannot be empty');
      }
      if (seenIds.has(stage.id)) {
        throw new InvalidFunnelError(`duplicated stage id "${stage.id}"`);
      }
      if (!isValidCapacity(stage.capacity)) {
        throw new InvalidFunnelError(
          `stage "${stage.id}" has capacity ${stage.capacity}, expected a non-negative integer`
        );
      }
      seenIds.add(stage.id);
    }

    // Copied so that mutating the array or the stage objects after construction
    // cannot change a funnel that has already been validated.
    this.stages = stages.map((stage) => ({ ...stage }));
  }

  /** New leads always enter here. */
  firstStageId(): string {
    return this.stages[0].id;
  }

  hasStage(stageId: string): boolean {
    return this.stages.some((stage) => stage.id === stageId);
  }

  /**
   * Whether the stage can hold one more lead, given how many it holds now.
   *
   * The occupancy is supplied by the caller on purpose: the funnel knows the
   * limit and the repository knows the occupancy, so only the use case sees
   * both. This is a question about the limit, not the capacity rule itself.
   */
  canAcceptOneMore(stageId: string, currentOccupancy: number): boolean {
    const { capacity } = this.stageOrFail(stageId);

    if (capacity === undefined) {
      return true;
    }

    return currentOccupancy < capacity;
  }

  private stageOrFail(stageId: string): Stage {
    const stage = this.stages.find((candidate) => candidate.id === stageId);

    if (stage === undefined) {
      throw new StageNotFoundError(stageId);
    }

    return stage;
  }
}

function isValidCapacity(capacity: number | undefined): boolean {
  return capacity === undefined || (Number.isInteger(capacity) && capacity >= 0);
}
