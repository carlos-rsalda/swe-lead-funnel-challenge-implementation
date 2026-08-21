export class StageNotFoundError extends Error {
  constructor(stageId: string) {
    super(`Stage ${stageId} does not exist in the funnel`);
    this.name = 'StageNotFoundError';
  }
}
