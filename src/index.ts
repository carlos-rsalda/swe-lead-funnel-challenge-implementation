import { Funnel } from './domain/entities/Funnel';
import { InMemoryLeadRepository } from './infrastructure/persistence/InMemoryLeadRepository';
import { AddLeadToFunnel } from './application/use-cases/AddLeadToFunnel';
import { MoveLeadToStage } from './application/use-cases/MoveLeadToStage';

/**
 * Simulation entry point.
 *
 * TODO: simulate the funnel flow with at least:
 * - one lead added successfully
 * - one valid stage move
 * - one duplicate lead rejected
 * - one invalid move rejected
 */
async function main(): Promise<void> {
  const funnel = new Funnel('funnel-1', [
    { id: 'new', name: 'New' },
    { id: 'contacted', name: 'Contacted' },
    { id: 'qualified', name: 'Qualified', capacity: 2 },
    { id: 'closed', name: 'Closed' },
  ]);

  const repository = new InMemoryLeadRepository();
  const addLead = new AddLeadToFunnel(repository, funnel);
  const moveLead = new MoveLeadToStage(repository, funnel);

  // TODO: implement the simulation
  console.log('Simulation not implemented yet');
}

main().catch(console.error);
