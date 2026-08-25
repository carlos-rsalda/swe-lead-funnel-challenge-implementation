import { AddLeadToFunnel } from '../../src/application/use-cases/AddLeadToFunnel';
import { DuplicateLeadError } from '../../src/domain/errors/DuplicateLeadError';
import { InvalidLeadError } from '../../src/domain/errors/InvalidLeadError';
import { InvalidPhoneNumberError } from '../../src/domain/errors/InvalidPhoneNumberError';
import { StageCapacityExceededError } from '../../src/domain/errors/StageCapacityExceededError';
import { FakeLeadRepository } from '../helpers/FakeLeadRepository';
import {
  ANOTHER_PHONE,
  A_PHONE,
  CLOSED,
  CONTACTED,
  NEW,
  QUALIFIED,
  funnelWith,
  lead,
} from '../helpers/factories';

/**
 * The precedence under test is not derived here. It is quoted from MAP.md §4:
 *
 *   entrada valida (PhoneNumber, name)  -> InvalidPhoneNumberError / InvalidLeadError
 *     -> duplicado                      -> DuplicateLeadError
 *     -> cupo en stages[0]              -> StageCapacityExceededError
 *     -> save
 *
 * and its principle, also verbatim:
 *
 *   "de lo que depende solo de la peticion a lo que depende del estado del mundo.
 *    Primero los errores estables ante un reintento."
 */
describe('AddLeadToFunnel', () => {
  describe('a valid lead', () => {
    it('enters the funnel and is saved', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await useCase.execute({ phone: A_PHONE, name: 'Ada' });

      expect(repository.saved).toHaveLength(1);
      expect(repository.saved[0].name).toBe('Ada');
    });

    it('always enters the first stage', async () => {
      // README rule: "New leads always enter the funnel's first stage."
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await useCase.execute({ phone: A_PHONE, name: 'Ada' });

      expect(repository.saved[0].stageId).toBe(NEW);
    });

    it('is stored under its canonical phone number, not the raw input', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await useCase.execute({ phone: '+52 (55) 1234-5678', name: 'Ada' });

      expect(repository.saved[0].phone.value).toBe('+525512345678');
    });
  });

  describe('rule 1 — the same phone number cannot exist twice', () => {
    it('rejects a phone number already in the funnel', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, name: 'Grace' })).rejects.toThrow(
        DuplicateLeadError
      );
    });

    it('rejects a duplicate no matter which stage the existing lead sits in', async () => {
      // MAP.md §3.6 — one use case instance is one funnel, so uniqueness is global
      // to the repository and not scoped to a stage.
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, CLOSED));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, name: 'Grace' })).rejects.toThrow(
        DuplicateLeadError
      );
    });

    it('rejects a duplicate written in a different presentation', async () => {
      // MAP.md §9 — "identidad: `+52 55 1234 5678` y `+525512345678` son el mismo lead".
      // The duplicate is only caught if the use case looks the lead up by the
      // canonical form; the repository does not canonicalise anything.
      const repository = FakeLeadRepository.seededWith(lead('+525512345678', NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: '+52 55 1234-5678', name: 'Grace' })).rejects.toThrow(
        DuplicateLeadError
      );
    });

    it('saves nothing when the lead is a duplicate', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, name: 'Grace' })).rejects.toThrow(DuplicateLeadError);
      expect(repository.saved).toEqual([]);
    });

    it('allows a different phone number', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await useCase.execute({ phone: ANOTHER_PHONE, name: 'Grace' });

      expect(repository.saved).toHaveLength(1);
    });
  });

  describe('rule 3 — adding into a full stage is rejected', () => {
    it('rejects the lead when the first stage is at its limit', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 1 }));

      await expect(useCase.execute({ phone: ANOTHER_PHONE, name: 'Grace' })).rejects.toThrow(
        StageCapacityExceededError
      );
    });

    it('accepts the lead while the first stage is below its limit', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 2 }));

      await useCase.execute({ phone: ANOTHER_PHONE, name: 'Grace' });

      expect(repository.saved).toHaveLength(1);
    });

    it('rejects every lead when the first stage is closed with capacity 0', async () => {
      // MAP.md §1 — "`0` = etapa cerrada (no ilimitada)". Read as falsy, an empty
      // stage with capacity 0 would accept this lead.
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 0 }));

      await expect(useCase.execute({ phone: A_PHONE, name: 'Ada' })).rejects.toThrow(
        StageCapacityExceededError
      );
      expect(repository.saved).toEqual([]);
    });

    it('measures the occupancy of the first stage, not of the whole funnel', async () => {
      const repository = FakeLeadRepository.seededWith(
        lead(A_PHONE, CONTACTED),
        lead(ANOTHER_PHONE, QUALIFIED)
      );
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 1 }));

      await useCase.execute({ phone: '+525599999999', name: 'Grace' });

      expect(repository.saved).toHaveLength(1);
    });

    it('saves nothing when the first stage is full', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 1 }));

      await expect(useCase.execute({ phone: ANOTHER_PHONE, name: 'Grace' })).rejects.toThrow(StageCapacityExceededError);
      expect(repository.saved).toEqual([]);
    });
  });

  describe('input validation', () => {
    it('rejects a malformed phone number', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: '5512345678', name: 'Ada' })).rejects.toThrow(
        InvalidPhoneNumberError
      );
    });

    it('rejects an empty name', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, name: '   ' })).rejects.toThrow(
        InvalidLeadError
      );
    });

    it('does not touch the repository when the input is malformed', async () => {
      // MAP.md §4 — "Primero los errores estables ante un reintento": input
      // validity depends on the request alone, so it is settled before any
      // question is put to the repository.
      const repository = new FakeLeadRepository();
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: 'not-a-phone', name: 'Ada' })).rejects.toThrow(InvalidPhoneNumberError);

      expect(repository.findByPhoneCalls).toEqual([]);
      expect(repository.findByStageCalls).toEqual([]);
      expect(repository.saved).toEqual([]);
    });
  });

  describe('precedence — MAP.md §4', () => {
    it('prefers the duplicate error when the lead is a duplicate and the first stage is full', async () => {
      // MAP.md §4, verbatim: "duplicado + primera etapa llena -> DuplicateLeadError.
      // El duplicado es permanente; el cupo es transitorio."
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 1 }));

      await expect(useCase.execute({ phone: A_PHONE, name: 'Grace' })).rejects.toThrow(
        DuplicateLeadError
      );
    });

    it('prefers the duplicate error even when the first stage is closed', async () => {
      // Same rule with the harshest capacity: capacity 0 cannot be satisfied by a
      // retry either, but the pipeline still settles the duplicate first.
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith({ [NEW]: 0 }));

      await expect(useCase.execute({ phone: A_PHONE, name: 'Grace' })).rejects.toThrow(
        DuplicateLeadError
      );
    });

    it('prefers the empty-name error over the duplicate error', async () => {
      // MAP.md §4 pipeline: "entrada valida (PhoneNumber, name) ... -> duplicado".
      // Note: the pipeline does not order InvalidPhoneNumberError against
      // InvalidLeadError between themselves, so no test asserts that pair.
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new AddLeadToFunnel(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, name: '' })).rejects.toThrow(InvalidLeadError);
    });
  });
});
