export type TerminalErrorKind =
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "MALFORMED_BODY"
  | "SCHEMA"
  | "DEGRADED"
  | "CONFIG";

export class TerminalClientError extends Error {
  readonly kind: TerminalErrorKind;
  readonly sourceEndpoint: string;
  readonly httpStatus?: number;
  readonly errorCode?: string;

  constructor(input: {
    kind: TerminalErrorKind;
    message: string;
    sourceEndpoint: string;
    httpStatus?: number;
    errorCode?: string;
    cause?: unknown;
  }) {
    super(input.message, input.cause !== undefined ? { cause: input.cause } : undefined);
    this.name = "TerminalClientError";
    this.kind = input.kind;
    this.sourceEndpoint = input.sourceEndpoint;
    if (input.httpStatus !== undefined) this.httpStatus = input.httpStatus;
    if (input.errorCode !== undefined) this.errorCode = input.errorCode;
  }
}
