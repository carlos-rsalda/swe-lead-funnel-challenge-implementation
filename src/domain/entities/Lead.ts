import { InvalidLeadError } from '../errors/InvalidLeadError';
import { InvalidStageTransitionError } from '../errors/InvalidStageTransitionError';
import { PhoneNumber } from '../value-objects/PhoneNumber';

/**
 * Lead entity.
 *
 * A lead represents a potential customer inside a funnel. It is identified by
 * its phone number, and it knows which stage it currently sits in.
 *
 * The stage is only reachable through `moveTo`, which guarantees the lead never
 * enters an invalid state whoever calls it. `isAt` answers the same question
 * without applying any rule, so a caller that needs to decide which error to
 * raise first can ask before acting.
 */
export class Lead {
  private _stageId: string;

  constructor(
    public readonly phone: PhoneNumber,
    public readonly name: string,
    stageId: string
  ) {
    if (name.trim().length === 0) {
      throw new InvalidLeadError('name cannot be empty');
    }

    this._stageId = stageId;
  }

  get stageId(): string {
    return this._stageId;
  }

  isAt(stageId: string): boolean {
    return this._stageId === stageId;
  }

  moveTo(targetStageId: string): void {
    if (this.isAt(targetStageId)) {
      throw new InvalidStageTransitionError(
        `Cannot move lead ${this.phone.value} from stage ${this._stageId} ` +
          `to stage ${targetStageId}: it is already there`
      );
    }

    this._stageId = targetStageId;
  }
}
