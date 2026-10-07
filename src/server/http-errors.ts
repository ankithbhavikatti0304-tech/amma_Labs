/** An error with a status code and a message that is safe to show to the person. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
