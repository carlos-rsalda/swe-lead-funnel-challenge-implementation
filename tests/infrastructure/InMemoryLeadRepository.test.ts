import { InMemoryLeadRepository } from '../../src/infrastructure/persistence/InMemoryLeadRepository';
import { ANOTHER_PHONE, A_PHONE, CONTACTED, NEW, lead, phone } from '../helpers/factories';

/**
 * MAP.md §7 — "InMemoryLeadRepository: `Map` indexado por el string canonico del
 * `PhoneNumber`" and "findByPhone devuelve `Lead | null` - null, no undefined".
 *
 * MAP.md §0 — "`save` es el unico camino de escritura => upsert por identidad".
 *
 * These call `findByPhone` with a `PhoneNumber`, which is what the port declares
 * (MAP.md §7): the adapter is handed an already canonical number and only has to
 * index it, so it never decides which two leads are the same.
 */
describe('InMemoryLeadRepository', () => {
  describe('save and findByPhone', () => {
    it('finds a saved lead by its phone number', async () => {
      const repository = new InMemoryLeadRepository();
      const ada = lead(A_PHONE, NEW);

      await repository.save(ada);

      expect(await repository.findByPhone(ada.phone)).toBe(ada);
    });

    it('returns null for a phone number it does not hold', async () => {
      const repository = new InMemoryLeadRepository();

      expect(await repository.findByPhone(phone(A_PHONE))).toBeNull();
    });

    it('is an upsert: saving the same identity twice keeps one lead', async () => {
      const repository = new InMemoryLeadRepository();
      const first = lead(A_PHONE, NEW, 'Ada');
      const second = lead(A_PHONE, CONTACTED, 'Ada Lovelace');

      await repository.save(first);
      await repository.save(second);

      expect(await repository.findByPhone(phone(A_PHONE))).toBe(second);
      expect(await repository.findByStage(NEW)).toEqual([]);
    });

    it('indexes by the canonical string, so presentation does not create a second entry', async () => {
      const repository = new InMemoryLeadRepository();

      await repository.save(lead('+52 55 1234-5678', NEW));

      expect(await repository.findByPhone(phone('+525512345678'))).not.toBeNull();
    });

    it('keeps distinct phone numbers apart', async () => {
      const repository = new InMemoryLeadRepository();
      const ada = lead(A_PHONE, NEW);
      const grace = lead(ANOTHER_PHONE, NEW);

      await repository.save(ada);
      await repository.save(grace);

      expect(await repository.findByPhone(phone(ANOTHER_PHONE))).toBe(grace);
    });
  });

  describe('findByStage', () => {
    it('returns an empty array for a stage with no leads', async () => {
      expect(await new InMemoryLeadRepository().findByStage(NEW)).toEqual([]);
    });

    it('returns only the leads sitting in that stage', async () => {
      const repository = new InMemoryLeadRepository();
      await repository.save(lead(A_PHONE, NEW));
      await repository.save(lead(ANOTHER_PHONE, CONTACTED));

      const inNew = await repository.findByStage(NEW);

      expect(inNew.map((entry) => entry.phone.value)).toEqual([A_PHONE]);
    });

    it('reflects a lead that moved, once it is saved again', async () => {
      const repository = new InMemoryLeadRepository();
      const ada = lead(A_PHONE, NEW);
      await repository.save(ada);

      ada.moveTo(CONTACTED);
      await repository.save(ada);

      expect(await repository.findByStage(NEW)).toEqual([]);
      expect(await repository.findByStage(CONTACTED)).toHaveLength(1);
    });

    it('is what the capacity check counts: occupancy is derived, never stored', async () => {
      // MAP.md §0 — "La ocupacion se calcula (`findByStage().length`), no se
      // almacena", which is why the port needs this method at all (MAP.md §2).
      const repository = new InMemoryLeadRepository();
      await repository.save(lead(A_PHONE, NEW));
      await repository.save(lead(ANOTHER_PHONE, NEW));

      expect((await repository.findByStage(NEW)).length).toBe(2);
    });
  });
});
