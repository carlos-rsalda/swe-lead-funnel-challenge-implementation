import { Funnel, Stage } from '../../src/domain/entities/Funnel';
import { Lead } from '../../src/domain/entities/Lead';
import { PhoneNumber } from '../../src/domain/value-objects/PhoneNumber';

export const NEW = 'new';
export const CONTACTED = 'contacted';
export const QUALIFIED = 'qualified';
export const CLOSED = 'closed';

/** A canonical, valid phone. Distinct numbers differ in the last digits. */
export const A_PHONE = '+525512345678';
export const ANOTHER_PHONE = '+525587654321';

export function phone(value: string = A_PHONE): PhoneNumber {
  return new PhoneNumber(value);
}

export function lead(value: string, stageId: string, name = 'Ada'): Lead {
  return new Lead(new PhoneNumber(value), name, stageId);
}

/**
 * A four-stage funnel with no capacity limits, so a test that is not about
 * capacity does not accidentally depend on one. Pass overrides to cap a stage.
 */
export function funnelWith(capacities: Partial<Record<string, number>> = {}): Funnel {
  const stages: Stage[] = [
    { id: NEW, name: 'New' },
    { id: CONTACTED, name: 'Contacted' },
    { id: QUALIFIED, name: 'Qualified' },
    { id: CLOSED, name: 'Closed' },
  ];

  return new Funnel(
    'funnel-1',
    stages.map((stage) =>
      capacities[stage.id] === undefined ? stage : { ...stage, capacity: capacities[stage.id] }
    )
  );
}
