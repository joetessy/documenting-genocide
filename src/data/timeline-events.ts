// Curated list of major moments in the war on Gaza since Oct 7, 2023.
// These render as small markers on the scrubber's histogram. Hovering a
// marker shows the date, title, and a one- to two-sentence description;
// clicking jumps the scrubber to that date. Keep the list short (12-15
// events) — too many makes the histogram noisy and undermines the
// "major moments" framing.
//
// Sources for these dates are widely covered by major outlets; we use the
// date the event began (or the date most commonly cited) rather than the
// date it was first reported. Descriptions stay short and factual.

export interface TimelineEvent {
  date: string;          // ISO YYYY-MM-DD
  title: string;         // Short, factual phrasing
  description: string;   // One- to two-sentence factual summary
  // Optional camera focus for the guided tour. When present, the tour eases
  // the map to this location at a moderate zoom with a slight pitch. Events
  // that affected the whole Strip (ceasefires, broad offensives, etc.)
  // intentionally leave `focus` undefined so the tour keeps the wide view.
  focus?: { lat: number; lon: number; zoom?: number };
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    date: '2023-10-07',
    title: 'Operation Al-Aqsa Flood',
    description:
      'Hamas-led attack on southern Israel killed roughly 1,200 Israelis and took 251 hostages, triggering the war.',
  },
  {
    date: '2023-10-17',
    title: 'Al-Ahli Arab Hospital explosion',
    description:
      'A blast in the hospital courtyard killed hundreds of Palestinians sheltering there. The cause remains disputed.',
    focus: { lat: 31.5053, lon: 34.4614, zoom: 16 },
  },
  {
    date: '2023-10-27',
    title: 'Israeli ground invasion begins',
    description:
      'Israeli forces crossed into northern Gaza; phone and internet services were cut across the Strip.',
    focus: { lat: 31.55, lon: 34.50, zoom: 14 },
  },
  {
    date: '2023-11-15',
    title: 'Al-Shifa Hospital raid begins',
    description:
      "Israeli forces entered Gaza's largest hospital, alleging an underground Hamas command center beneath the complex.",
    focus: { lat: 31.5240, lon: 34.4480, zoom: 16 },
  },
  {
    date: '2023-11-24',
    title: 'First humanitarian pause begins',
    description:
      'A Qatar- and Egypt-mediated week-long truce saw 105 hostages and 240 Palestinian prisoners released, with limited aid entering Gaza.',
  },
  {
    date: '2024-02-29',
    title: 'Flour Massacre at Nabulsi roundabout',
    description:
      'At least 118 Palestinians were killed when Israeli troops fired on crowds awaiting an aid convoy in Gaza City.',
    focus: { lat: 31.5310, lon: 34.4640, zoom: 16 },
  },
  {
    date: '2024-04-01',
    title: 'World Central Kitchen convoy strike',
    description:
      'Three Israeli drone strikes killed seven aid workers from six countries, halting most Gaza aid distribution in the aftermath.',
    focus: { lat: 31.4180, lon: 34.3560, zoom: 15 },
  },
  {
    date: '2024-05-06',
    title: 'Rafah ground offensive begins',
    description:
      'Israeli forces seized the Rafah border crossing and began operations in a city sheltering over a million displaced people.',
    focus: { lat: 31.2960, lon: 34.2430, zoom: 15 },
  },
  {
    date: '2024-05-26',
    title: 'Al-Mawasi tent camp strike',
    description:
      'Airstrikes on the designated "humanitarian zone" killed at least 45 displaced Palestinians and ignited a fire through the camp.',
    focus: { lat: 31.3200, lon: 34.2700, zoom: 16 },
  },
  {
    date: '2024-08-10',
    title: 'Al-Tabaeen school strike',
    description:
      'Airstrikes on a school complex sheltering displaced people killed at least 93 Palestinians during dawn prayer.',
    focus: { lat: 31.5200, lon: 34.4700, zoom: 16 },
  },
  {
    date: '2024-10-16',
    title: 'Yahya Sinwar killed',
    description:
      'The Hamas leader considered the architect of October 7 was killed by Israeli forces in Rafah.',
    focus: { lat: 31.3000, lon: 34.2500, zoom: 15 },
  },
  {
    date: '2025-01-19',
    title: 'Ceasefire Phase 1 begins',
    description:
      'A three-phase deal took effect, beginning a 42-day pause with hostage exchanges and expanded humanitarian aid.',
  },
  {
    date: '2025-03-18',
    title: 'Israel resumes Gaza operations',
    description:
      "Following the first phase's collapse, Israel resumed large-scale airstrikes and ground operations after a two-month pause.",
  },
  {
    date: '2025-05-19',
    title: "Operation Gideon's Chariots launched",
    description:
      'A new offensive aimed at seizing more of Gaza despite famine warnings and intensifying international pressure.',
  },
];
