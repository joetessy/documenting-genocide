/**
 * Build the damage vector tileset + header stats from the GeoJSON that
 * `pnpm build-data` produces (public/data/damage.geojson.gz).
 *
 * Outputs (committed to the repo, served as static assets):
 *   - public/damage.pmtiles      vector tiles for the damage layer
 *   - public/damage-stats.json   cumulative "destroyed" counts per assessment
 *                                date, for the header counter (the client no
 *                                longer loads the full 43MB GeoJSON)
 *
 * Requires tippecanoe on PATH (`brew install tippecanoe`). Because tippecanoe
 * can't run in the Cloudflare build, this is a LOCAL step: after refreshing the
 * damage data with `pnpm build-data`, run `pnpm build-damage-tiles` and commit
 * the two artifacts. OCHA publishes new assessments roughly quarterly.
 */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SRC = 'public/data/damage.geojson.gz';
const OUT_PMTILES = 'public/damage.pmtiles';
const OUT_STATS = 'public/damage-stats.json';

interface ProgressionPass { date: string; class: number }
interface DamageProps {
  status?: string;
  assessment_date?: string;
  governorate?: string;
  progression?: ProgressionPass[];
}
interface DamageFeature {
  id: string;
  geometry: GeoJSON.Point;
  properties: DamageProps;
}

async function main(): Promise<void> {
  const gz = await readFile(SRC);
  const fc = JSON.parse(gunzipSync(gz).toString('utf8')) as { features: DamageFeature[] };
  const feats = fc.features;
  console.log(`Loaded ${feats.length} damage features from ${SRC}`);

  // Line-delimited GeoJSON for tippecanoe. The string feature id ("unosat-N")
  // can't ride along as an MVT feature id (those must be integers), so we carry
  // it as a property. `progression` is an array — MVT properties are scalar
  // only, so we JSON-encode it and the client parses it back on click.
  const lines: string[] = [];
  const destroyedByDate = new Map<string, number>();
  const totalByDate = new Map<string, number>();

  for (const f of feats) {
    const p = f.properties ?? {};
    const props: Record<string, string> = {
      id: f.id,
      status: p.status ?? '',
      assessment_date: p.assessment_date ?? '',
    };
    if (p.governorate) props.governorate = p.governorate;
    if (Array.isArray(p.progression) && p.progression.length > 1) {
      props.progression = JSON.stringify(p.progression);
    }
    lines.push(JSON.stringify({ type: 'Feature', geometry: f.geometry, properties: props }));

    if (p.assessment_date) {
      totalByDate.set(p.assessment_date, (totalByDate.get(p.assessment_date) ?? 0) + 1);
      if (p.status === 'destroyed') {
        destroyedByDate.set(p.assessment_date, (destroyedByDate.get(p.assessment_date) ?? 0) + 1);
      }
    }
  }

  const tmpPath = join(tmpdir(), 'damage-for-tiles.geojsonl');
  await writeFile(tmpPath, lines.join('\n'));

  // -Z5..-z16: full point detail at high zoom (no dropping where tiles are
  // small), --drop-densest-as-needed thins the dense low-zoom overview tiles so
  // they stay under the size limit (and the map holds far fewer points zoomed out).
  console.log('Tiling with tippecanoe…');
  execFileSync('tippecanoe', [
    '-o', OUT_PMTILES,
    '-l', 'damage',
    '-Z', '5',
    '-z', '16',
    '--drop-densest-as-needed',
    '--force',
    '--quiet',
    tmpPath,
  ], { stdio: 'inherit' });
  await rm(tmpPath, { force: true });

  // Cumulative destroyed-building counts by assessment date for the header.
  const dateStrings = [...destroyedByDate.keys()].sort();
  const cumCount: number[] = [];
  let cc = 0;
  for (const d of dateStrings) {
    cc += destroyedByDate.get(d)!;
    cumCount.push(cc);
  }
  // Per-assessment-date total feature counts for the scrubber histogram's
  // damage series (all statuses, not just destroyed).
  const perDate = [...totalByDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  await writeFile(OUT_STATS, JSON.stringify({ dateStrings, cumCount, perDate }));

  console.log(`Wrote ${OUT_PMTILES} and ${OUT_STATS} (${dateStrings.length} assessment dates, ${cc.toLocaleString()} destroyed total)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
