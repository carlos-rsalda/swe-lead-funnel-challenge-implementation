import { AddLeadToFunnel } from '../../src/application/use-cases/AddLeadToFunnel';
import { MoveLeadToStage } from '../../src/application/use-cases/MoveLeadToStage';
import { DuplicateLeadError } from '../../src/domain/errors/DuplicateLeadError';
import { StageCapacityExceededError } from '../../src/domain/errors/StageCapacityExceededError';
import { InMemoryLeadRepository } from '../../src/infrastructure/persistence/InMemoryLeadRepository';
import { CLOSED, CONTACTED, NEW, QUALIFIED, funnelWith, phone } from '../helpers/factories';

/**
 * The seam, not the rules.
 *
 * Every other suite isolates one piece: the use case tests run against
 * `FakeLeadRepository`, and `InMemoryLeadRepository` is exercised on its own.
 * Nothing joins the real adapter to the real use cases, so until now that
 * wiring only ran inside `index.ts`, where nothing asserts on it.
 *
 * These four cases use the real funnel, the real repository and both use cases
 * wired the way `index.ts` wires them. They do not re-test the rules — they test
 * that the pieces agree once they are connected.
 *
 * The fake is still needed elsewhere and is left alone: asserting that the
 * occupancy is never queried requires a repository that records its calls, which
 * is not observable against the real adapter.
 */

const A_THIRD_PHONE = '+525599999999';

describe('funnel flow, end to end', () => {
  it('frees a slot when a lead moves out, and the add that was rejected then succeeds', async () => {
    const repository = new InMemoryLeadRepository();
    const funnel = funnelWith({ [NEW]: 2 });
    const addLead = new AddLeadToFunnel(repository, funnel);
    const moveLead = new MoveLeadToStage(repository, funnel);

    await addLead.execute({ phone: '+525512345678', name: 'Ada' });
    await addLead.execute({ phone: '+525587654321', name: 'Grace' });
    expect(await repository.findByStage(NEW)).toHaveLength(2);

    await expect(addLead.execute({ phone: A_THIRD_PHONE, name: 'Hopper' })).rejects.toThrow(
      StageCapacityExceededError
    );
    expect(await repository.findByStage(NEW)).toHaveLength(2);

    await moveLead.execute({ phone: '+525512345678', targetStageId: CONTACTED });
    expect(await repository.findByStage(NEW)).toHaveLength(1);

    await addLead.execute({ phone: A_THIRD_PHONE, name: 'Hopper' });

    expect(await repository.findByStage(NEW)).toHaveLength(2);
    expect((await repository.findByPhone(phone(A_THIRD_PHONE)))?.stageId).toBe(NEW);
  });

  it('detects a duplicate written in another presentation, through the canonical index', async () => {
    const repository = new InMemoryLeadRepository();
    const funnel = funnelWith();
    const addLead = new AddLeadToFunnel(repository, funnel);

    await addLead.execute({ phone: '+52 55 1234 5678', name: 'Ada' });

    await expect(
      addLead.execute({ phone: '+52 (55) 1234-5678', name: 'Ada Lovelace' })
    ).rejects.toThrow(DuplicateLeadError);

    expect(await repository.findByStage(NEW)).toHaveLength(1);
  });

  it('leaves a rejected lead in its original stage in the real store', async () => {
    const repository = new InMemoryLeadRepository();
    const funnel = funnelWith({ [QUALIFIED]: 1 });
    const addLead = new AddLeadToFunnel(repository, funnel);
    const moveLead = new MoveLeadToStage(repository, funnel);

    await addLead.execute({ phone: '+525512345678', name: 'Ada' });
    await addLead.execute({ phone: '+525587654321', name: 'Grace' });
    await moveLead.execute({ phone: '+525587654321', targetStageId: QUALIFIED });

    await expect(
      moveLead.execute({ phone: '+525512345678', targetStageId: QUALIFIED })
    ).rejects.toThrow(StageCapacityExceededError);

    // Read back from the repository rather than from a reference held here: the
    // question is what the store holds, not what an object in this test holds.
    expect((await repository.findByPhone(phone('+525512345678')))?.stageId).toBe(NEW);
    expect((await repository.findByStage(NEW)).map((entry) => entry.name)).toEqual(['Ada']);
    expect(await repository.findByStage(QUALIFIED)).toHaveLength(1);
  });

  it('ends with each lead in the stage the sequence left it in', async () => {
    const repository = new InMemoryLeadRepository();
    const funnel = funnelWith();
    const addLead = new AddLeadToFunnel(repository, funnel);
    const moveLead = new MoveLeadToStage(repository, funnel);

    await addLead.execute({ phone: '+525512345678', name: 'Ada' });
    await addLead.execute({ phone: '+525587654321', name: 'Grace' });
    await addLead.execute({ phone: A_THIRD_PHONE, name: 'Hopper' });
    await moveLead.execute({ phone: '+525512345678', targetStageId: CONTACTED });
    await moveLead.execute({ phone: '+525587654321', targetStageId: QUALIFIED });
    await moveLead.execute({ phone: A_THIRD_PHONE, targetStageId: CLOSED });

    // `findByStage` gives no ordering guarantee, so the names are sorted here.
    const namesIn = async (stageId: string) =>
      (await repository.findByStage(stageId)).map((entry) => entry.name).sort();

    expect(await namesIn(NEW)).toEqual([]);
    expect(await namesIn(CONTACTED)).toEqual(['Ada']);
    expect(await namesIn(QUALIFIED)).toEqual(['Grace']);
    expect(await namesIn(CLOSED)).toEqual(['Hopper']);
  });
});
