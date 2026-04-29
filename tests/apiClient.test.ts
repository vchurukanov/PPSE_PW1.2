import { ApiClientError, getData, postData } from "../refactored/apiClient";

function createJsonResponse(body: unknown, status = 200, url = "https://api.test/resource"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("refactored apiClient", () => {
  test("getData повертає розпарсений JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ ok: true }, 200));
    const sleepMock = jest.fn().mockResolvedValue(undefined);

    const result = await getData<{ ok: boolean }>("https://api.test/data", {}, fetchMock, sleepMock);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("postData надсилає POST, JSON body і повертає відповідь", async () => {
    const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ id: 123 }, 201));
    const sleepMock = jest.fn().mockResolvedValue(undefined);

    const payload = { name: "Test" };
    const result = await postData<typeof payload, { id: number }>(
      "https://api.test/items",
      payload,
      {},
      fetchMock,
      sleepMock,
    );

    expect(result).toEqual({ id: 123 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  test("кидає ApiClientError для 404 без retry", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response("Not found", { status: 404 }));
    const sleepMock = jest.fn().mockResolvedValue(undefined);

    await expect(getData("https://api.test/missing", {}, fetchMock, sleepMock)).rejects.toBeInstanceOf(
      ApiClientError,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledTimes(0);
  });

  test("робить retry при мережевій помилці і потім успішно завершує", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }, 200));

    const sleepMock = jest.fn().mockResolvedValue(undefined);

    const result = await getData<{ ok: boolean }>(
      "https://api.test/retry",
      { retries: 3, baseDelayMs: 100 },
      fetchMock,
      sleepMock,
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(100);
  });

  test("робить retry при 503 і успішно завершує", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse({ recovered: true }, 200));

    const sleepMock = jest.fn().mockResolvedValue(undefined);

    const result = await getData<{ recovered: boolean }>(
      "https://api.test/unstable",
      { retries: 3, baseDelayMs: 50 },
      fetchMock,
      sleepMock,
    );

    expect(result.recovered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(50);
  });

  test("після вичерпання retry кидає мережеву помилку", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("network down"));
    const sleepMock = jest.fn().mockResolvedValue(undefined);

    await expect(
      getData("https://api.test/offline", { retries: 3, baseDelayMs: 10 }, fetchMock, sleepMock),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      status: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 10);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 20);
  });

  test("не повторює запит для 400", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response("Bad request", { status: 400 }));
    const sleepMock = jest.fn().mockResolvedValue(undefined);

    await expect(
      postData("https://api.test/bad", { x: 1 }, { retries: 3, baseDelayMs: 10 }, fetchMock, sleepMock),
    ).rejects.toBeInstanceOf(ApiClientError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledTimes(0);
  });

  test("кидає помилку при невалідному JSON у 200-відповіді", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response("<html>oops</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const sleepMock = jest.fn().mockResolvedValue(undefined);

    await expect(getData("https://api.test/html", {}, fetchMock, sleepMock)).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });
});
