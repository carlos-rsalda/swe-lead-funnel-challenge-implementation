/**
 * Lead entity.
 *
 * A lead represents a potential customer inside a funnel.
 * It is identified by its phone number within a funnel.
 *
 * TODO: add the properties and validations you consider appropriate.
 */
export class Lead {
  constructor(
    public readonly phone: string,
    public readonly name: string,
    public stageId: string
  ) {
    // TODO: validate constructor arguments
  }
}
