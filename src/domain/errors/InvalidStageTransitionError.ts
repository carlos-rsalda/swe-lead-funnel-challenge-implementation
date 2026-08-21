export class InvalidStageTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStageTransitionError';
  }
}
