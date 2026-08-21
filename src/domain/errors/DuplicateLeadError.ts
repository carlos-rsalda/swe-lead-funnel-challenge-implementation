export class DuplicateLeadError extends Error {
  constructor(phone: string) {
    super(`A lead with phone ${phone} already exists in the funnel`);
    this.name = 'DuplicateLeadError';
  }
}
