export class ApiClientError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly details?: string;

  constructor(message: string, status: number, url: string, details?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.url = url;
    this.details = details;
  }
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type SleepLike = (ms: number) => Promise<void>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(baseDelayMs: number, attempt: number): number {
  return baseDelayMs * Math.pow(2, attempt - 1);
}

function shouldRetry(status: number): boolean {
  return status >= 500 || status === 429;
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiClientError("Сервер повернув невалідний JSON", response.status, response.url, text);
  }
}

export async function request<TResponse>(
  url: string,
  init: RequestInit = {},
  retryOptions: RetryOptions = {},
  fetchImpl: FetchLike = fetch,
  sleepImpl: SleepLike = defaultSleep,
): Promise<TResponse> {
  const retries = retryOptions.retries ?? 3;
  const baseDelayMs = retryOptions.baseDelayMs ?? 200;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, init);

      if (response.ok) {
        return await parseResponseBody<TResponse>(response);
      }

      if (attempt < retries && shouldRetry(response.status)) {
        await sleepImpl(backoffDelay(baseDelayMs, attempt));
        continue;
      }

      const details = await response.text().catch(() => "");
      throw new ApiClientError(`HTTP ${response.status}`, response.status, url, details);
    } catch (error) {
      lastError = error;

      if (error instanceof ApiClientError && error.status > 0 && !shouldRetry(error.status)) {
        throw error;
      }

      if (attempt >= retries) {
        if (error instanceof ApiClientError) {
          throw error;
        }
        throw new ApiClientError("Мережева помилка", 0, url, String((error as Error).message || error));
      }

      await sleepImpl(backoffDelay(baseDelayMs, attempt));
    }
  }

  throw new ApiClientError("Невідома помилка запиту", 0, url, String(lastError));
}

export async function getData<TResponse>(
  url: string,
  retryOptions: RetryOptions = {},
  fetchImpl: FetchLike = fetch,
  sleepImpl: SleepLike = defaultSleep,
): Promise<TResponse> {
  return request<TResponse>(url, { method: "GET" }, retryOptions, fetchImpl, sleepImpl);
}

export async function postData<TRequest, TResponse>(
  url: string,
  data: TRequest,
  retryOptions: RetryOptions = {},
  fetchImpl: FetchLike = fetch,
  sleepImpl: SleepLike = defaultSleep,
): Promise<TResponse> {
  return request<TResponse>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    retryOptions,
    fetchImpl,
    sleepImpl,
  );
}
