export class StageCapacityExceededError extends Error {
  constructor(stageId: string) {
    super(`Stage ${stageId} is at full capacity`);
    this.name = 'StageCapacityExceededError';
  }
}
