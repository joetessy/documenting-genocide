// Gaza Strip outline + point-in-polygon test, shared between client-side
// map rendering (src/map/gaza-boundary.ts) and build-time normalize
// functions (scripts/normalize-*.ts). Source: geoBoundaries (CC BY 4.0),
// simplified to 161 vertices.

import { GAZA_OUTLINE } from '../src/map/gaza-boundary';

export { GAZA_OUTLINE };

// Bbox enclosing the polygon — used as a cheap early-reject before the
// O(N) ray-cast test. Most rejected points are far outside Gaza so the
// bbox check eliminates them in O(1).
const BBOX = { minLat: 31.20, maxLat: 31.60, minLon: 34.20, maxLon: 34.60 };

/**
 * Ray-casting point-in-polygon test against the Gaza Strip outline.
 * Returns true when (lat, lon) falls inside the polygon. Significantly
 * tighter than a bbox check — it excludes Israeli border communities
 * (Be'eri, Kfar Aza, Nahal Oz, Sderot) and Egyptian territory south of
 * the Rafah border, both of which the bbox keeps.
 */
export function isInGazaPolygon(lat: number, lon: number): boolean {
  // Cheap bbox reject first.
  if (lat < BBOX.minLat || lat > BBOX.maxLat) return false;
  if (lon < BBOX.minLon || lon > BBOX.maxLon) return false;

  // Standard ray-casting algorithm. Iterate each polygon edge; count how
  // many cross a horizontal ray going east from (lon, lat). Odd = inside.
  let inside = false;
  const n = GAZA_OUTLINE.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [lonI, latI] = GAZA_OUTLINE[i];
    const [lonJ, latJ] = GAZA_OUTLINE[j];
    const intersect = ((latI > lat) !== (latJ > lat))
      && (lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI);
    if (intersect) inside = !inside;
  }
  return inside;
}
