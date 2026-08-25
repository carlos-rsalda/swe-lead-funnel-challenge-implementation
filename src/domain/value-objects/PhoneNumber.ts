import { InvalidPhoneNumberError } from '../errors/InvalidPhoneNumberError';

/**
 * Phone number value object.
 *
 * A phone number is the identity of a lead: two leads are the same lead when
 * their canonical form is the same string.
 *
 * Accepted format: a "+" followed by 8 to 15 digits. Separators are ignored
 * because they are presentation, not data: what decides identity is the "+"
 * and the digits, so "+52 55 1234 5678", "+52-55-1234-5678" and
 * "+525512345678" are the same number.
 *
 * Everything else is rejected, including numbers written without a country
 * code. Presentation is normalized, meaning is never inferred: turning a local
 * number into a canonical one requires a default region, which is workspace
 * configuration this service never receives, so the ambiguity is given back to
 * the caller instead of being guessed here.
 */
export class PhoneNumber {
  private static readonly MIN_DIGITS = 8;
  private static readonly MAX_DIGITS = 15;

  public readonly value: string;

  constructor(input: string) {
    if (typeof input !== 'string') {
      throw new InvalidPhoneNumberError(String(input));
    }

    const candidate = [...input].filter((character) => !isSeparator(character)).join('');
    const digits = candidate.slice(1);

    const startsWithPlus = candidate.startsWith('+');
    const isAllDigits = [...digits].every(isDigit);
    const hasAcceptedLength =
      digits.length >= PhoneNumber.MIN_DIGITS && digits.length <= PhoneNumber.MAX_DIGITS;

    if (!startsWithPlus || !isAllDigits || !hasAcceptedLength) {
      throw new InvalidPhoneNumberError(input);
    }

    this.value = candidate;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

}

const SEPARATORS = ' -().';

function isSeparator(character: string): boolean {
  return SEPARATORS.includes(character);
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}
