// Shared HTTP retry policy. User and repository adapters retain their own requests and parsing.
const RETRIES = 3;
const RETRY_STATUS = new Set([500, 502, 503, 504]);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @param {RequestInit} request
 * @param {{fetchImpl: typeof fetch, retryDelay?: number, soft?: number[], repositoryLabel?: string}} options
 */
export async function requestGitHub(url, request, { fetchImpl, retryDelay = 1500, soft = [], repositoryLabel }) {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === RETRIES;
    let response;
    try {
      response = await fetchImpl(url, request);
    } catch (error) {
      if (last) throw new Error(`Could not reach GitHub: ${error.message}`);
      await sleep(retryDelay * 2 ** attempt);
      continue;
    }
    if (soft.includes(response.status)) return { status: response.status, data: null, headers: response.headers };
    if (!response.ok) {
      if (RETRY_STATUS.has(response.status) && !last) {
        await sleep(retryDelay * 2 ** attempt);
        continue;
      }
      if (response.status === 404 && repositoryLabel !== undefined) {
        throw new Error(`Repository "${repositoryLabel}" not found, or the token can't see it (GitHub answered 404)`);
      }
      const detail = (await response.text()).slice(0, 200);
      throw new Error(`GitHub answered ${response.status}: ${detail}`);
    }
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
}
