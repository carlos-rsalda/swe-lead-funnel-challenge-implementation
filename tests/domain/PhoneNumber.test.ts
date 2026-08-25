import { PhoneNumber } from '../../src/domain/value-objects/PhoneNumber';
import { InvalidPhoneNumberError } from '../../src/domain/errors/InvalidPhoneNumberError';

/**
 * MAP.md §1 — "Acepta: `+` seguido de 8-15 digitos, ignorando separadores:
 * espacios, guiones, parentesis y puntos. Rechaza: todo lo demas."
 *
 * MAP.md §1 — "normalizamos presentacion, nunca inferimos semantica."
 */
describe('PhoneNumber', () => {
  describe('accepted format: "+" followed by 8 to 15 digits', () => {
    it('accepts the shortest accepted length (8 digits)', () => {
      expect(new PhoneNumber('+12345678').value).toBe('+12345678');
    });

    it('accepts the longest accepted length (15 digits)', () => {
      expect(new PhoneNumber('+123456789012345').value).toBe('+123456789012345');
    });

    it('rejects one digit below the lower bound', () => {
      expect(() => new PhoneNumber('+1234567')).toThrow(InvalidPhoneNumberError);
    });

    it('rejects one digit above the upper bound', () => {
      expect(() => new PhoneNumber('+1234567890123456')).toThrow(InvalidPhoneNumberError);
    });
  });

  describe('separators are presentation, not data', () => {
    it.each([
      ['spaces', '+52 55 1234 5678'],
      ['dashes', '+52-55-1234-5678'],
      ['parentheses', '+52(55)12345678'],
      ['dots', '+52.55.1234.5678'],
      ['a mix of all of them', '+52 (55) 1234-5678'],
    ])('ignores %s', (_label, input) => {
      expect(new PhoneNumber(input).value).toBe('+525512345678');
    });

    it('produces a canonical form with no separators left in it', () => {
      expect(new PhoneNumber('+52 (55) 1234-5678').value).toBe('+525512345678');
    });

    it('counts digits after removing separators, not before', () => {
      // 8 digits written across separators is still 8 digits.
      expect(new PhoneNumber('+1 234-5678').value).toBe('+12345678');
    });
  });

  describe('rejected input', () => {
    it.each([
      ['no country code', '5512345678'],
      ['a leading zero instead of "+"', '005512345678'],
      ['letters', '+52-CALL-NOW'],
      ['an extension', '+525512345678 ext 3'],
      ['an empty string', ''],
      ['only a plus sign', '+'],
      ['only separators', '   '],
      ['a plus that is not leading', '52+5512345678'],
    ])('rejects %s', (_label, input) => {
      expect(() => new PhoneNumber(input)).toThrow(InvalidPhoneNumberError);
    });

    it('names the rejected input in the error, so the caller can see what failed', () => {
      expect(() => new PhoneNumber('5512345678')).toThrow(/5512345678/);
    });
  });

  describe('identity', () => {
    it('treats two presentations of the same number as equal', () => {
      // MAP.md §9 — "identidad: `+52 55 1234 5678` y `+525512345678` son el mismo lead"
      expect(new PhoneNumber('+52 55 1234 5678').equals(new PhoneNumber('+525512345678'))).toBe(
        true
      );
    });

    it('treats different digits as different numbers', () => {
      expect(new PhoneNumber('+525512345678').equals(new PhoneNumber('+525587654321'))).toBe(false);
    });

    it('does not unify numbers that differ in their digits, only in their separators', () => {
      // MAP.md §1 — the `521` case: "ahi la diferencia esta en los digitos, no en la
      // presentacion", and unifying them would require inferring that the `1` is a
      // Mexican mobile prefix. Presentation is normalised; meaning is never inferred.
      expect(new PhoneNumber('+5215512345678').equals(new PhoneNumber('+525512345678'))).toBe(
        false
      );
    });
  });
});
