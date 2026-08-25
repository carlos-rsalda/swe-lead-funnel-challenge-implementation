export class InvalidFunnelError extends Error {
  constructor(reason: string) {
    super(`Invalid funnel: ${reason}`);
    this.name = 'InvalidFunnelError';
  }
}
