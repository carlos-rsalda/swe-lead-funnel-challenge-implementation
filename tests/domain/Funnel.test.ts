import { Funnel, Stage } from '../../src/domain/entities/Funnel';
import { InvalidFunnelError } from '../../src/domain/errors/InvalidFunnelError';
import { StageNotFoundError } from '../../src/domain/errors/StageNotFoundError';
import { CLOSED, CONTACTED, NEW, QUALIFIED, funnelWith } from '../helpers/factories';

/**
 * MAP.md §1 — "Valida al construirse -> InvalidFunnelError: >=1 etapa; ids no
 * vacios y unicos; capacity entera >= 0 si esta presente."
 *
 * MAP.md §3.2 — "Capacidad: ausente = sin tope . `0` = etapa cerrada .
 * negativa/no entera = funnel invalido."
 */
describe('Funnel', () => {
  describe('construction', () => {
    it('rejects a funnel with no stages', () => {
      expect(() => new Funnel('f', [])).toThrow(InvalidFunnelError);
    });

    it('rejects an empty stage id', () => {
      expect(() => new Funnel('f', [{ id: '', name: 'New' }])).toThrow(InvalidFunnelError);
    });

    it('rejects a stage id made only of whitespace', () => {
      expect(() => new Funnel('f', [{ id: '   ', name: 'New' }])).toThrow(InvalidFunnelError);
    });

    it('rejects duplicated stage ids', () => {
      expect(
        () =>
          new Funnel('f', [
            { id: NEW, name: 'New' },
            { id: NEW, name: 'New again' },
          ])
      ).toThrow(InvalidFunnelError);
    });

    it('rejects a negative capacity', () => {
      expect(() => new Funnel('f', [{ id: NEW, name: 'New', capacity: -1 }])).toThrow(
        InvalidFunnelError
      );
    });

    it('rejects a non-integer capacity', () => {
      expect(() => new Funnel('f', [{ id: NEW, name: 'New', capacity: 1.5 }])).toThrow(
        InvalidFunnelError
      );
    });

    it('accepts an absent capacity', () => {
      expect(() => new Funnel('f', [{ id: NEW, name: 'New' }])).not.toThrow();
    });

    it('accepts a capacity of zero, because zero is a closed stage and not an invalid one', () => {
      expect(() => new Funnel('f', [{ id: NEW, name: 'New', capacity: 0 }])).not.toThrow();
    });

    it('names the failing cause in the error, not just the funnel', () => {
      // MAP.md §3 — "con el id de un funnel en la mano no se sabe si fallo por no
      // tener etapas, por ids duplicados o por una capacity invalida".
      expect(() => new Funnel('f', [])).toThrow(/stage/i);
    });

    it('is not affected by mutating the stages passed in after construction', () => {
      // Funnel.ts:53-55 — the stages are copied so that "mutating the array or the
      // stage objects after construction cannot change a funnel that has already
      // been validated".
      const stages: Stage[] = [{ id: NEW, name: 'New', capacity: 1 }];
      const funnel = new Funnel('f', stages);

      stages[0].capacity = 99;
      stages.push({ id: 'smuggled', name: 'Smuggled' });

      expect(funnel.canAcceptOneMore(NEW, 1)).toBe(false);
      expect(funnel.hasStage('smuggled')).toBe(false);
    });
  });

  describe('stages', () => {
    it('reports the first stage, which is where new leads enter', () => {
      expect(funnelWith().firstStageId()).toBe(NEW);
    });

    it('takes stage order from the array position', () => {
      // MAP.md §0 — "Orden de etapas = posicion en el array; sin campo `order`".
      const funnel = new Funnel('f', [
        { id: CLOSED, name: 'Closed' },
        { id: NEW, name: 'New' },
      ]);

      expect(funnel.firstStageId()).toBe(CLOSED);
    });

    it('knows which stages it has', () => {
      const funnel = funnelWith();

      expect(funnel.hasStage(QUALIFIED)).toBe(true);
      expect(funnel.hasStage('nope')).toBe(false);
    });

    it('rejects a question about a stage it does not have', () => {
      expect(() => funnelWith().canAcceptOneMore('nope', 0)).toThrow(StageNotFoundError);
    });
  });

  describe('capacity', () => {
    it('accepts one more lead when the stage has no limit, however full it is', () => {
      expect(funnelWith().canAcceptOneMore(NEW, 10_000)).toBe(true);
    });

    it('accepts one more lead while the occupancy is below the limit', () => {
      expect(funnelWith({ [QUALIFIED]: 2 }).canAcceptOneMore(QUALIFIED, 1)).toBe(true);
    });

    it('refuses one more lead once the occupancy reaches the limit', () => {
      expect(funnelWith({ [QUALIFIED]: 2 }).canAcceptOneMore(QUALIFIED, 2)).toBe(false);
    });

    it('refuses one more lead when the occupancy is somehow above the limit', () => {
      expect(funnelWith({ [QUALIFIED]: 2 }).canAcceptOneMore(QUALIFIED, 3)).toBe(false);
    });

    describe('capacity: 0 means the stage is closed, not unlimited', () => {
      // MAP.md §1 — "Semantica de `capacity`: `undefined` = sin tope; `0` = etapa
      // cerrada (no ilimitada)". And the trap this guards against, verbatim:
      // "el tipo es `number | undefined` y `strict` no protege contra
      // `if (stage.capacity && ...)`, que trataria `0` como ilimitado."
      it('refuses a lead even when the stage is empty', () => {
        expect(funnelWith({ [QUALIFIED]: 0 }).canAcceptOneMore(QUALIFIED, 0)).toBe(false);
      });

      it('does not behave like an absent capacity', () => {
        const closed = funnelWith({ [QUALIFIED]: 0 });
        const unlimited = funnelWith();

        expect(closed.canAcceptOneMore(QUALIFIED, 0)).toBe(false);
        expect(unlimited.canAcceptOneMore(QUALIFIED, 0)).toBe(true);
      });
    });
  });
});
