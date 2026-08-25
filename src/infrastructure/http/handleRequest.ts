import { AddLeadToFunnel } from '../../application/use-cases/AddLeadToFunnel';
import { MoveLeadToStage } from '../../application/use-cases/MoveLeadToStage';
import { DuplicateLeadError } from '../../domain/errors/DuplicateLeadError';
import { InvalidLeadError } from '../../domain/errors/InvalidLeadError';
import { InvalidPhoneNumberError } from '../../domain/errors/InvalidPhoneNumberError';
import { InvalidStageTransitionError } from '../../domain/errors/InvalidStageTransitionError';
import { LeadNotFoundError } from '../../domain/errors/LeadNotFoundError';
import { StageCapacityExceededError } from '../../domain/errors/StageCapacityExceededError';
import { StageNotFoundError } from '../../domain/errors/StageNotFoundError';

/** A request that has already been parsed: this adapter does no I/O and no JSON parsing. */
export interface HttpRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body?: { error: string; message: string };
}

/** The use cases are handed in, not built here: composition stays in the caller, as in `index.ts`. */
export interface UseCases {
  addLeadToFunnel: AddLeadToFunnel;
  moveLeadToStage: MoveLeadToStage;
}

/**
 * Simulated HTTP entry point. Two routes, no router:
 *
 *   POST /leads        { phone, name }             -> add a lead to the first stage
 *   POST /leads/move   { phone, targetStageId }    -> move a lead to another stage
 *
 * The status mapping is the precedence principle seen from outside: what the
 * client can fix on its own is a 4xx it can retry meaningfully, what conflicts
 * with the current state is a 409, and anything that is not a known domain
 * error is a bug of ours rather than the client's fault.
 *
 * Fields are read defensively because a parsed body is still untrusted input; a
 * missing or non-string field becomes an empty string, which the domain then
 * rejects with the error that names it.
 */
export async function handleRequest(
  request: HttpRequest,
  useCases: UseCases
): Promise<HttpResponse> {
  const fields = (request.body ?? {}) as Record<string, unknown>;
  const phone = typeof fields.phone === 'string' ? fields.phone : '';

  try {
    if (request.method === 'POST' && request.path === '/leads') {
      const name = typeof fields.name === 'string' ? fields.name : '';

      await useCases.addLeadToFunnel.execute({ phone, name });

      // 204 and no body: `execute()` returns `Promise<void>`, so there is no
      // resource to return — the same decision that makes the error the output contract.
      return { status: 204 };
    }

    if (request.method === 'POST' && request.path === '/leads/move') {
      const targetStageId = typeof fields.targetStageId === 'string' ? fields.targetStageId : '';

      await useCases.moveLeadToStage.execute({ phone, targetStageId });

      return { status: 204 };
    }

    return {
      status: 404,
      body: { error: 'RouteNotFound', message: `No route for ${request.method} ${request.path}` },
    };
  } catch (error) {
    // The request alone is wrong, or it names a stage the immutable funnel does
    // not have: the client can fix it without anything else changing.
    if (
      error instanceof InvalidPhoneNumberError ||
      error instanceof InvalidLeadError ||
      error instanceof StageNotFoundError
    ) {
      return { status: 400, body: { error: error.name, message: error.message } };
    }

    if (error instanceof LeadNotFoundError) {
      return { status: 404, body: { error: error.name, message: error.message } };
    }

    // Conflicts with the current state of the funnel. The capacity one may stop
    // being true tomorrow; the duplicate will not.
    if (
      error instanceof DuplicateLeadError ||
      error instanceof StageCapacityExceededError ||
      error instanceof InvalidStageTransitionError
    ) {
      return { status: 409, body: { error: error.name, message: error.message } };
    }

    return { status: 500, body: { error: 'InternalError', message: 'Unexpected error' } };
  }
}
