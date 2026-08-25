import { Lead } from '../../src/domain/entities/Lead';
import { InvalidLeadError } from '../../src/domain/errors/InvalidLeadError';
import { InvalidStageTransitionError } from '../../src/domain/errors/InvalidStageTransitionError';
import { CONTACTED, NEW, phone } from '../helpers/factories';

/**
 * MAP.md §2 — the only invariants the lead can hold on its own are the ones that
 * depend on nothing but its own state: a non-empty name, and "Destino != actual"
 * inside `moveTo()`. Everything else (the stage existing, the stage having room)
 * belongs to the funnel or to the use case.
 */
describe('Lead', () => {
  describe('name', () => {
    it('rejects an empty name', () => {
      expect(() => new Lead(phone(), '', NEW)).toThrow(InvalidLeadError);
    });

    it('rejects a name made only of whitespace', () => {
      expect(() => new Lead(phone(), '   ', NEW)).toThrow(InvalidLeadError);
    });

    it('accepts a name with content', () => {
      expect(new Lead(phone(), 'Ada', NEW).name).toBe('Ada');
    });
  });

  describe('stage', () => {
    it('starts at the stage it was constructed with', () => {
      expect(new Lead(phone(), 'Ada', NEW).stageId).toBe(NEW);
    });

    it('moves to a different stage', () => {
      const lead = new Lead(phone(), 'Ada', NEW);

      lead.moveTo(CONTACTED);

      expect(lead.stageId).toBe(CONTACTED);
    });

    it('rejects a move to the stage it is already in', () => {
      // MAP.md §2 — "Destino != actual | Lead.moveTo() | depende solo del estado
      // del propio lead".
      const lead = new Lead(phone(), 'Ada', NEW);

      expect(() => lead.moveTo(NEW)).toThrow(InvalidStageTransitionError);
    });

    it('stays in its stage when the move is rejected', () => {
      const lead = new Lead(phone(), 'Ada', NEW);

      expect(() => lead.moveTo(NEW)).toThrow(InvalidStageTransitionError);
      expect(lead.stageId).toBe(NEW);
    });

    it('reports both ends of the rejected transition in the error message', () => {
      // MAP.md §3 — "una transicion es una relacion binaria - origen y destino.
      // `InvalidStageTransitionError(stageId)` no podria decir de donde venia el lead."
      const lead = new Lead(phone(), 'Ada', NEW);
      lead.moveTo(CONTACTED);

      expect(() => lead.moveTo(CONTACTED)).toThrow(
        expect.objectContaining({ message: expect.stringContaining(CONTACTED) })
      );
    });

    it('does not police whether the target stage exists in any funnel', () => {
      // MAP.md §2 — "La etapa destino existe | Funnel | unico que conoce su
      // configuracion". The lead holds a stageId, not a reference to a Stage, so
      // it cannot and must not answer this.
      const lead = new Lead(phone(), 'Ada', NEW);

      lead.moveTo('a-stage-no-funnel-has');

      expect(lead.stageId).toBe('a-stage-no-funnel-has');
    });
  });

  describe('isAt', () => {
    it('is true for the stage the lead sits in', () => {
      expect(new Lead(phone(), 'Ada', NEW).isAt(NEW)).toBe(true);
    });

    it('is false for any other stage', () => {
      expect(new Lead(phone(), 'Ada', NEW).isAt(CONTACTED)).toBe(false);
    });

    it('is a pure query: it neither throws nor moves the lead', () => {
      // MAP.md §2 — "Lead.isAt(stageId): boolean - consulta pura, sin regla dentro."
      // This is what lets the use case ask "same stage?" before deciding which
      // error wins, without mutating anything.
      const lead = new Lead(phone(), 'Ada', NEW);

      expect(() => lead.isAt(NEW)).not.toThrow();
      expect(lead.stageId).toBe(NEW);
    });
  });
});
