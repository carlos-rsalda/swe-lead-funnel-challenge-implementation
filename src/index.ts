import { AddLeadToFunnel } from './application/use-cases/AddLeadToFunnel';
import { MoveLeadToStage } from './application/use-cases/MoveLeadToStage';
import { Funnel } from './domain/entities/Funnel';
import { InMemoryLeadRepository } from './infrastructure/persistence/InMemoryLeadRepository';

/**
 * Simulation entry point.
 *
 * The first stage has a limit so that rule 3 can be seen in both of the
 * directions the README names: "Moving or adding a lead into a full stage".
 *
 * That limit makes the scenarios interact, and the order below is designed
 * around it rather than around the reading order. Occupancy is built on
 * purpose: two leads are added to fill "New" before the third is rejected, and
 * that same third lead is added again at the end, after a move has freed a slot.
 * The rejection is therefore about the occupancy at that moment and not about
 * the lead, which is the whole point of the capacity rule.
 *
 * The occupancy of "New" is printed after every step so the interaction is
 * visible instead of implied.
 */

/** Ada's number, written the way a sales agent would type it. */
const ADA = '+52 55 1234 5678';
/** The same number in another presentation: same lead, different formatting. */
const ADA_AGAIN = '+52 (55) 1234-5678';
const GRACE = '+525587654321';
const HOPPER = '+525599999999';

async function main(): Promise<void> {
  const funnel = new Funnel('funnel-1', [
    { id: 'new', name: 'New', capacity: 2 },
    { id: 'contacted', name: 'Contacted' },
    { id: 'qualified', name: 'Qualified', capacity: 2 },
    { id: 'closed', name: 'Closed' },
  ]);

  const repository = new InMemoryLeadRepository();
  const addLead = new AddLeadToFunnel(repository, funnel);
  const moveLead = new MoveLeadToStage(repository, funnel);

  console.log('Lead Funnel Service — simulation');
  console.log('Funnel funnel-1: New (max 2) -> Contacted -> Qualified (max 2) -> Closed\n');

  console.log('1. Add Ada, written with spaces');
  try {
    await addLead.execute({ phone: ADA, name: 'Ada' });
    console.log('   accepted: Ada entered "new"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('2. Add Grace, which fills "new" on purpose');
  try {
    await addLead.execute({ phone: GRACE, name: 'Grace' });
    console.log('   accepted: Grace entered "new"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('3. Add Hopper into a first stage that is now full');
  try {
    await addLead.execute({ phone: HOPPER, name: 'Hopper' });
    console.log('   accepted: Hopper entered "new"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('4. Add Ada again, in a different presentation of the same number');
  try {
    await addLead.execute({ phone: ADA_AGAIN, name: 'Ada Lovelace' });
    console.log('   accepted: a second Ada entered "new"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('5. Move Ada from "new" to "contacted"');
  try {
    await moveLead.execute({ phone: ADA, targetStageId: 'contacted' });
    console.log('   accepted: Ada is now in "contacted"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('6. Move Ada to "contacted" again, the stage she is already in');
  try {
    await moveLead.execute({ phone: ADA, targetStageId: 'contacted' });
    console.log('   accepted: Ada is now in "contacted"');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('7. Add Hopper again, now that step 5 has freed a slot in "new"');
  try {
    await addLead.execute({ phone: HOPPER, name: 'Hopper' });
    console.log('   accepted: Hopper entered "new" — step 3 was about the occupancy, not the lead');
  } catch (error) {
    console.log(`   rejected: ${(error as Error).name} — ${(error as Error).message}`);
  }
  console.log(`   "new" holds ${(await repository.findByStage('new')).length} of 2\n`);

  console.log('Final state');
  console.log(`   New:       ${(await repository.findByStage('new')).map((lead) => lead.name).join(', ')}`);
  console.log(`   Contacted: ${(await repository.findByStage('contacted')).map((lead) => lead.name).join(', ')}`);
  console.log(`   Qualified: ${(await repository.findByStage('qualified')).map((lead) => lead.name).join(', ')}`);
  console.log(`   Closed:    ${(await repository.findByStage('closed')).map((lead) => lead.name).join(', ')}`);
}

main().catch(console.error);
