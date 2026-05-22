import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const OAUTH_URL = 'https://acleddata.com/oauth/token';
const API_URL = 'https://acleddata.com/api/acled/read';
const COUNTRY = 'Palestine';
const ADMIN1 = 'Gaza Strip';
const START_DATE = '2023-10-07';
const PER_PAGE = 5000;
const OUT_DIR = 'data/raw/acled';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function getAccessToken(): Promise<string> {
  const username = process.env.ACLED_USERNAME;
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'ACLED_USERNAME and ACLED_PASSWORD must be set in .env. ' +
      'Register at https://acleddata.com/register-for-access/'
    );
  }
  const body = new URLSearchParams({
    username,
    password,
    grant_type: 'password',
    client_id: 'acled',
    scope: 'authenticated',
  });
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`ACLED OAuth failed: status ${res.status} — check ACLED_USERNAME/PASSWORD`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('ACLED OAuth returned no access_token');
  return json.access_token;
}

async function fetchAcledPage(token: string, page: number): Promise<unknown[]> {
  const params = new URLSearchParams({
    _format: 'json',
    country: COUNTRY,
    admin1: ADMIN1,
    event_date: START_DATE,
    event_date_where: '>=',
    page: String(page),
    limit: String(PER_PAGE),
  });
  const url = `${API_URL}?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`ACLED fetch failed: page=${page} status=${res.status}`);
  const json = (await res.json()) as { data?: unknown[]; status?: number };
  if (!Array.isArray(json.data)) {
    throw new Error(`ACLED response missing 'data' array on page ${page}`);
  }
  return json.data;
}

export async function fetchAcled(opts: { refresh?: boolean } = {}): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const token = await getAccessToken();
  console.log('ACLED auth OK.');

  let page = 1;
  while (true) {
    const out = join(OUT_DIR, `page-${String(page).padStart(3, '0')}.json`);
    if (!opts.refresh && (await fileExists(out))) {
      console.log(`Page ${page} cached, skipping`);
      const cached = JSON.parse(await readFile(out, 'utf8')) as unknown[];
      if (cached.length < PER_PAGE) {
        console.log(`Cached page ${page} was partial (size=${cached.length}); done.`);
        break;
      }
      page++;
      continue;
    }
    await sleep(500);
    const records = await fetchAcledPage(token, page);
    await writeFile(out, JSON.stringify(records));
    console.log(`Fetched page ${page} (${records.length} records)`);
    if (records.length < PER_PAGE) {
      console.log('Final page reached.');
      break;
    }
    page++;
  }
  console.log('ACLED fetch complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const refresh = process.argv.includes('--refresh');
  fetchAcled({ refresh }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
