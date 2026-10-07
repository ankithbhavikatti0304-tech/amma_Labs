'use client';

/** An error from our API, with the message safe to show to the person. */
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { ...(body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, 'network', "Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiFailure(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', e?.fields, e?.retryAfter);
  }
  return data as T;
}

export const apiGet = <T,>(url: string) => call<T>('GET', url);
export const apiPost = <T,>(url: string, body?: unknown, headers?: Record<string, string>) => call<T>('POST', url, body ?? {}, headers);
export const apiPut = <T,>(url: string, body?: unknown) => call<T>('PUT', url, body ?? {});
export const apiPatch = <T,>(url: string, body?: unknown) => call<T>('PATCH', url, body ?? {});
export const apiDelete = <T,>(url: string) => call<T>('DELETE', url);
export const apiUpload = <T,>(url: string, form: FormData) => call<T>('POST', url, form);
