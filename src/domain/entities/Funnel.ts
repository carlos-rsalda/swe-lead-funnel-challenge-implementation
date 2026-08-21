/**
 * Funnel entity.
 *
 * A funnel is an ordered list of stages. Each stage may define an
 * optional capacity limit (maximum number of leads it can hold).
 *
 * TODO: complete the entity with the behavior the use cases need
 * (e.g. finding a stage, knowing the first stage, checking capacity).
 */
export interface Stage {
  id: string;
  name: string;
  capacity?: number;
}

export class Funnel {
  constructor(
    public readonly id: string,
    public readonly stages: Stage[]
  ) {
    // TODO: validate constructor arguments
  }
}
