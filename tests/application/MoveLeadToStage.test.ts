import { MoveLeadToStage } from '../../src/application/use-cases/MoveLeadToStage';
import { InvalidPhoneNumberError } from '../../src/domain/errors/InvalidPhoneNumberError';
import { InvalidStageTransitionError } from '../../src/domain/errors/InvalidStageTransitionError';
import { LeadNotFoundError } from '../../src/domain/errors/LeadNotFoundError';
import { StageCapacityExceededError } from '../../src/domain/errors/StageCapacityExceededError';
import { StageNotFoundError } from '../../src/domain/errors/StageNotFoundError';
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
 *   entrada valida (PhoneNumber)        -> InvalidPhoneNumberError
 *     -> etapa destino existe           -> StageNotFoundError
 *     -> lead existe                    -> LeadNotFoundError
 *     -> destino != actual              -> InvalidStageTransitionError
 *     -> cupo en destino                -> StageCapacityExceededError
 *     -> moveTo + save
 */
describe('MoveLeadToStage', () => {
  describe('a valid move', () => {
    it('moves the lead to the target stage and saves it', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await useCase.execute({ phone: A_PHONE, targetStageId: CONTACTED });

      expect(ada.stageId).toBe(CONTACTED);
      expect(repository.saved).toHaveLength(1);
    });

    it('finds the lead by the canonical form of the phone number', async () => {
      const repository = FakeLeadRepository.seededWith(lead('+525512345678', NEW));
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await useCase.execute({ phone: '+52 (55) 1234-5678', targetStageId: CONTACTED });

      expect(repository.saved).toHaveLength(1);
    });
  });

  describe('rule — transitions are open in every direction', () => {
    // MAP.md §3.1 — "Transiciones abiertas. Cualquier etapa existente distinta de
    // la actual - adelante, atras o salto. Incluye salir de `Closed`." The README
    // names exactly one invalid transition (rule 4); there is nothing else to forbid.
    it.each([
      ['forward', NEW, CONTACTED],
      ['skipping a stage', NEW, CLOSED],
      ['backward', QUALIFIED, NEW],
      ['out of the last stage', CLOSED, CONTACTED],
    ])('allows moving %s', async (_label, from, to) => {
      const ada = lead(A_PHONE, from);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await useCase.execute({ phone: A_PHONE, targetStageId: to });

      expect(ada.stageId).toBe(to);
    });
  });

  describe('rule 2 — the target stage must exist', () => {
    it('rejects a target stage the funnel does not have', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: 'archived' })
      ).rejects.toThrow(StageNotFoundError);
    });
  });

  describe('the lead must exist', () => {
    it('rejects a phone number the repository does not know', async () => {
      // MAP.md §3.3 — "Lead inexistente al mover: error de dominio propio
      // (LeadNotFoundError), no reciclar uno existente."
      const repository = new FakeLeadRepository();
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: CONTACTED })
      ).rejects.toThrow(LeadNotFoundError);
    });
  });

  describe('rule 4 — a lead cannot move to the stage it is already in', () => {
    it('rejects the move', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, CONTACTED));
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: CONTACTED })
      ).rejects.toThrow(InvalidStageTransitionError);
    });

    it('saves nothing', async () => {
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, CONTACTED));
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(useCase.execute({ phone: A_PHONE, targetStageId: CONTACTED })).rejects.toThrow(InvalidStageTransitionError);
      expect(repository.saved).toEqual([]);
    });
  });

  describe('rule 3 — moving into a full stage is rejected', () => {
    it('rejects the move when the target stage is at its limit', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada, lead(ANOTHER_PHONE, QUALIFIED));
      const useCase = new MoveLeadToStage(repository, funnelWith({ [QUALIFIED]: 1 }));

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
      ).rejects.toThrow(StageCapacityExceededError);
    });

    it('allows the move while the target stage is below its limit', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada, lead(ANOTHER_PHONE, QUALIFIED));
      const useCase = new MoveLeadToStage(repository, funnelWith({ [QUALIFIED]: 2 }));

      await useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED });

      expect(ada.stageId).toBe(QUALIFIED);
    });

    it('counts the occupancy of the target stage, not of the origin stage', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada, lead(ANOTHER_PHONE, NEW));
      const useCase = new MoveLeadToStage(repository, funnelWith({ [NEW]: 2, [QUALIFIED]: 1 }));

      await useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED });

      expect(ada.stageId).toBe(QUALIFIED);
    });

    it('rejects every move into a stage closed with capacity 0, even an empty one', async () => {
      // MAP.md §1 — "`0` = etapa cerrada (no ilimitada)".
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith({ [CLOSED]: 0 }));

      await expect(useCase.execute({ phone: A_PHONE, targetStageId: CLOSED })).rejects.toThrow(
        StageCapacityExceededError
      );
    });

    it('does not treat a capacity of 0 like an absent capacity', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await useCase.execute({ phone: A_PHONE, targetStageId: CLOSED });

      expect(ada.stageId).toBe(CLOSED);
    });
  });

  describe('input validation', () => {
    it('rejects a malformed phone number', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: '5512345678', targetStageId: CONTACTED })
      ).rejects.toThrow(InvalidPhoneNumberError);
    });

    it('does not touch the repository when the input is malformed', async () => {
      const repository = new FakeLeadRepository();
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: 'not-a-phone', targetStageId: CONTACTED })
      ).rejects.toThrow(InvalidPhoneNumberError);

      expect(repository.findByPhoneCalls).toEqual([]);
      expect(repository.saved).toEqual([]);
    });
  });

  describe('precedence — MAP.md §4', () => {
    it('prefers the phone-number error over the missing-stage error', async () => {
      // MAP.md §4: "entrada valida (PhoneNumber) -> etapa destino existe".
      const repository = new FakeLeadRepository();
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: 'not-a-phone', targetStageId: 'archived' })
      ).rejects.toThrow(InvalidPhoneNumberError);
    });

    it('prefers the missing-stage error over the missing-lead error', async () => {
      // MAP.md §4: "Por que `StageNotFoundError` va antes que `LeadNotFoundError`:
      // el funnel se fija en el constructor y es inmutable en runtime, asi que la
      // validez de `targetStageId` es funcion pura de peticion + config; la
      // existencia del lead depende del repositorio."
      const repository = new FakeLeadRepository();
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: 'archived' })
      ).rejects.toThrow(StageNotFoundError);
    });

    it('does not consult the repository for a stage the funnel does not have', async () => {
      // Same decision, its second stated reason: "evita una consulta al repo en el
      // caso de fallo".
      const repository = FakeLeadRepository.seededWith(lead(A_PHONE, NEW));
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: 'archived' })
      ).rejects.toThrow(StageNotFoundError);

      expect(repository.findByPhoneCalls).toEqual([]);
    });

    describe('moving a lead to the stage it is already in, when that stage is full', () => {
      // MAP.md §4, verbatim: "misma etapa + llena -> InvalidStageTransitionError.
      // La peticion es incoherente en si misma; la ocupacion ni se consulta."
      const fullStageWithTheLeadInIt = () => {
        const ada = lead(A_PHONE, QUALIFIED);
        return {
          ada,
          repository: FakeLeadRepository.seededWith(ada),
          funnel: funnelWith({ [QUALIFIED]: 1 }),
        };
      };

      it('prefers the transition error over the capacity error', async () => {
        const { repository, funnel } = fullStageWithTheLeadInIt();
        const useCase = new MoveLeadToStage(repository, funnel);

        await expect(
          useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
        ).rejects.toThrow(InvalidStageTransitionError);
      });

      it('never asks the repository for the occupancy', async () => {
        const { repository, funnel } = fullStageWithTheLeadInIt();
        const useCase = new MoveLeadToStage(repository, funnel);

        await expect(
          useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
        ).rejects.toThrow(InvalidStageTransitionError);

        expect(repository.findByStageCalls).toEqual([]);
      });

      it('holds even when the stage is closed with capacity 0', async () => {
        const ada = lead(A_PHONE, QUALIFIED);
        const repository = FakeLeadRepository.seededWith(ada);
        const useCase = new MoveLeadToStage(repository, funnelWith({ [QUALIFIED]: 0 }));

        await expect(
          useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
        ).rejects.toThrow(InvalidStageTransitionError);
        expect(repository.findByStageCalls).toEqual([]);
      });
    });
  });

  describe('a rejected move leaves the lead where it was — MAP.md §5', () => {
    // MAP.md §5 — the repository stores live references, so "mutar el `Lead`
    // devuelto por `findByPhone` cambia el estado persistido sin llamar a `save`".
    // The mitigation is an ordering discipline, not a structural guarantee:
    // "moveTo() puede seguir invocandose antes de comprobar el cupo". These tests
    // are the "blindaje" the MAP names for it, so they assert on the very instance
    // the repository handed out.
    it('when the target stage is full', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada, lead(ANOTHER_PHONE, QUALIFIED));
      const useCase = new MoveLeadToStage(repository, funnelWith({ [QUALIFIED]: 1 }));

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
      ).rejects.toThrow(StageCapacityExceededError);

      expect(ada.stageId).toBe(NEW);
      expect(repository.saved).toEqual([]);
    });

    it('when the target stage is closed with capacity 0', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith({ [CLOSED]: 0 }));

      await expect(useCase.execute({ phone: A_PHONE, targetStageId: CLOSED })).rejects.toThrow(StageCapacityExceededError);

      expect(ada.stageId).toBe(NEW);
      expect(repository.saved).toEqual([]);
    });

    it('when the target stage does not exist', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada);
      const useCase = new MoveLeadToStage(repository, funnelWith());

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: 'archived' })
      ).rejects.toThrow(StageNotFoundError);

      expect(ada.stageId).toBe(NEW);
      expect(repository.saved).toEqual([]);
    });

    it('and the stage it was in still reports it afterwards', async () => {
      const ada = lead(A_PHONE, NEW);
      const repository = FakeLeadRepository.seededWith(ada, lead(ANOTHER_PHONE, QUALIFIED));
      const useCase = new MoveLeadToStage(repository, funnelWith({ [QUALIFIED]: 1 }));

      await expect(
        useCase.execute({ phone: A_PHONE, targetStageId: QUALIFIED })
      ).rejects.toThrow(StageCapacityExceededError);

      const stillInNew = await repository.findByStage(NEW);
      expect(stillInNew.map((entry) => entry.phone.value)).toEqual([A_PHONE]);
    });
  });
});
