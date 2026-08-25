export class LeadNotFoundError extends Error {
  constructor(phone: string) {
    super(`No lead with phone ${phone} exists in the funnel`);
    this.name = 'LeadNotFoundError';
  }
}
