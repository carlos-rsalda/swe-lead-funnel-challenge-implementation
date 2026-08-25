import { AddLeadToFunnel } from '../../src/application/use-cases/AddLeadToFunnel';
import { MoveLeadToStage } from '../../src/application/use-cases/MoveLeadToStage';
import { UseCases, handleRequest } from '../../src/infrastructure/http/handleRequest';
import { InMemoryLeadRepository } from '../../src/infrastructure/persistence/InMemoryLeadRepository';
import { CONTACTED, NEW, funnelWith } from '../helpers/factories';

/**
 * What only this adapter can get wrong.
 *
 * The error-to-status mapping is not tested branch by branch: each branch is one
 * `instanceof` mapping to the status it says it maps to, and the decision behind
 * it is recorded in MAP.md and ANALYSIS.md. Asserting it again here would only
 * restate the table.
 *
 * These four cover what the table cannot: that untrusted fields do not escape
 * as our fault, that an unknown route is answered rather than thrown, and that
 * each of the two routes actually reaches its use case. A route is the one thing
 * no other suite can vouch for — a typo in a path would leave every other test
 * passing while the endpoint answered 404 forever.
 */
function wire(): { repository: InMemoryLeadRepository; useCases: UseCases } {
  const repository = new InMemoryLeadRepository();
  const funnel = funnelWith();

  return {
    repository,
    useCases: {
      addLeadToFunnel: new AddLeadToFunnel(repository, funnel),
      moveLeadToStage: new MoveLeadToStage(repository, funnel),
    },
  };
}

describe('handleRequest', () => {
  it('answers 400 for a missing field, not 500', async () => {
    // A parsed body is still untrusted input. Without the `typeof` read,
    // `name.trim()` would throw a TypeError and leave as an InternalError —
    // reporting the client's mistake as a bug of ours.
    const { useCases } = wire();

    const response = await handleRequest(
      { method: 'POST', path: '/leads', body: { phone: '+525512345678', name: undefined } },
      useCases
    );

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('InvalidLeadError');
  });

  it('answers 404 for a route it does not have', async () => {
    const { useCases } = wire();

    const response = await handleRequest({ method: 'GET', path: '/funnels' }, useCases);

    expect(response.status).toBe(404);
    expect(response.body?.error).toBe('RouteNotFound');
  });

  it('reaches the use case: a valid add returns 204 with no body and stores the lead', async () => {
    const { repository, useCases } = wire();

    const response = await handleRequest(
      { method: 'POST', path: '/leads', body: { phone: '+52 55 1234 5678', name: 'Ada' } },
      useCases
    );

    expect(response).toEqual({ status: 204 });
    expect((await repository.findByStage(NEW)).map((lead) => lead.name)).toEqual(['Ada']);
  });

  it('reaches the use case: a valid move returns 204 with no body and moves the lead', async () => {
    const { repository, useCases } = wire();
    await handleRequest(
      { method: 'POST', path: '/leads', body: { phone: '+525512345678', name: 'Ada' } },
      useCases
    );

    const response = await handleRequest(
      {
        method: 'POST',
        path: '/leads/move',
        body: { phone: '+525512345678', targetStageId: CONTACTED },
      },
      useCases
    );

    expect(response).toEqual({ status: 204 });
    expect(await repository.findByStage(NEW)).toEqual([]);
    expect((await repository.findByStage(CONTACTED)).map((lead) => lead.name)).toEqual(['Ada']);
  });
});
