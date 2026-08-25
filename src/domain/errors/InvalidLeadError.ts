export class InvalidLeadError extends Error {
  constructor(reason: string) {
    super(`Invalid lead: ${reason}`);
    this.name = 'InvalidLeadError';
  }
}
