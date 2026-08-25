export class InvalidPhoneNumberError extends Error {
  constructor(input: string) {
    super(`Invalid phone number "${input}": expected "+" followed by 8 to 15 digits`);
    this.name = 'InvalidPhoneNumberError';
  }
}
