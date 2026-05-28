// Curated list of major moments in the Genocide on Gaza since Oct 7, 2023.
// These render as small markers on the scrubber's histogram. Hovering a
// marker shows the date, title, and a one- to two-sentence description;
// clicking jumps the scrubber to that date. Keep the list short (12-15
// events) — too many makes the histogram noisy and undermines the
// "major moments" framing.
//
// Sources for these dates are widely covered by major outlets; we use the
// date the event began (or the date most commonly cited) rather than the
// date it was first reported. Descriptions stay short and factual.

export interface TimelineEventSource {
  name: string;   // Short label shown in the side panel
  url: string;    // Citable URL
}

export interface TimelineEvent {
  date: string;          // ISO YYYY-MM-DD
  title: string;         // Short, factual phrasing
  description: string;   // One- to two-sentence factual summary
  // Optional camera focus for the guided tour. When present, the tour eases
  // the map to this location. `zoom`, `pitch`, and `bearing` are each optional
  // and override per-stop defaults (zoom 14, pitch 40, bearing 0) so the tour
  // can vary cadence — closer/lower for intimate scenes, wider/flatter for
  // broad offensives, with occasional rotations to keep the sequence dynamic.
  // Events that affected the whole Strip (ceasefires, anniversaries, etc.)
  // intentionally leave `focus` undefined so the tour keeps the wide view.
  focus?: { lat: number; lon: number; zoom?: number; pitch?: number; bearing?: number };
  // Optional rich data shown when the event marker is clicked on the map or
  // when its tick is clicked on the histogram. Casualty figures should cite
  // a specific source (e.g. Gaza Health Ministry or UN-reported).
  casualties?: { killed?: number; injured?: number };
  sources?: TimelineEventSource[];
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    date: '2023-10-07',
    title: 'Operation Al-Aqsa Flood',
    description:
      'Palestinian resistance groups attacked southern Israel, killing roughly 1,200 Israelis and taking 251 hostages, triggering the war.',
  },
  {
    date: '2023-10-27',
    title: 'Israeli ground invasion begins',
    description:
      'Israeli forces crossed into northern Gaza; phone and internet services were cut across the Strip.',
    focus: { lat: 31.55, lon: 34.50, zoom: 13, pitch: 25, bearing: 15 },
    sources: [
      { name: 'Wikipedia — Gaza war', url: 'https://en.wikipedia.org/wiki/Gaza_war' },
    ],
  },
  {
    date: '2023-10-31',
    title: 'Jabalia refugee camp airstrikes',
    description:
      'Large Israeli airstrikes struck the densely populated Jabalia refugee camp over two days, flattening apartment blocks and leaving deep craters. Scores of Palestinians were reported killed.',
    focus: { lat: 31.5300, lon: 34.4900, zoom: 15, pitch: 45, bearing: -15 },
    sources: [
      { name: 'Wikipedia — Jabalia refugee camp airstrikes', url: 'https://en.wikipedia.org/wiki/Jabalia_refugee_camp_airstrikes' },
    ],
  },
  {
    date: '2023-11-15',
    title: 'Al-Shifa Hospital raid begins',
    description:
      "Israeli forces entered Gaza's largest hospital, alleging an underground Hamas command center beneath the complex.",
    focus: { lat: 31.5240, lon: 34.4480, zoom: 16, pitch: 50, bearing: 10 },
    sources: [
      { name: 'Wikipedia — Al-Shifa Hospital siege', url: 'https://en.wikipedia.org/wiki/Al-Shifa_Hospital_siege' },
    ],
  },
  {
    date: '2023-11-24',
    title: 'First humanitarian pause begins',
    description:
      'A Qatar- and Egypt-mediated week-long truce saw 105 hostages and 240 Palestinian prisoners released, with limited aid entering Gaza.',
  },
  {
    date: '2024-01-29',
    title: 'Killing of Hind Rajab',
    description:
      'Hind Rajab, six, was trapped in a car in Gaza City among relatives shot dead around her, pleading by phone for rescue. Two paramedics sent to save her were killed too; the car was later found struck by 335 bullets.',
    focus: { lat: 31.5130, lon: 34.4350, zoom: 16, pitch: 52, bearing: -18 },
    casualties: { killed: 9 },   // Hind, six relatives in the car, and two PRCS paramedics (reported total)
    sources: [
      { name: 'Wikipedia — Killing of Hind Rajab', url: 'https://en.wikipedia.org/wiki/Killing_of_Hind_Rajab' },
    ],
  },
  {
    date: '2024-02-29',
    title: 'Flour Massacre at Nabulsi roundabout',
    description:
      'Israeli forces opened fire on thousands of Palestinians awaiting an aid convoy on Al-Rashid Street in Gaza City. Witnesses reported sustained shooting for over an hour as civilians scrambled for flour.',
    focus: { lat: 31.5310, lon: 34.4640, zoom: 16, pitch: 45, bearing: -10 },
    casualties: { killed: 118, injured: 760 },   // Gaza Ministry of Health
    sources: [
      { name: 'Wikipedia — Flour Massacre', url: 'https://en.wikipedia.org/wiki/Flour_massacre' },
      { name: 'Al Jazeera — inside the Flour Massacre', url: 'https://www.aljazeera.com/news/longform/2024/3/5/the-blood-was-everywhere-inside-israels-flour-massacre-in-gaza' },
    ],
  },
  {
    date: '2024-04-01',
    title: 'World Central Kitchen convoy strike',
    description:
      'Three Israeli drone strikes hit a marked World Central Kitchen aid convoy in Deir al-Balah, killing seven aid workers from six countries. The strike halted most Gaza aid distribution in the days that followed.',
    focus: { lat: 31.4180, lon: 34.3560, zoom: 15, pitch: 35, bearing: 22 },
    casualties: { killed: 7 },
    sources: [
      { name: 'Wikipedia — WCK convoy strike', url: 'https://en.wikipedia.org/wiki/2024_Israeli_attack_on_World_Central_Kitchen_convoy' },
    ],
  },
  {
    date: '2024-05-06',
    title: 'Rafah ground offensive begins',
    description:
      'Israeli forces seized the Rafah border crossing and began operations in a city sheltering over a million displaced people.',
    focus: { lat: 31.2960, lon: 34.2430, zoom: 14, pitch: 30, bearing: -15 },
    sources: [
      { name: 'Wikipedia — Rafah offensive', url: 'https://en.wikipedia.org/wiki/Rafah_offensive' },
    ],
  },
  {
    date: '2024-06-08',
    title: 'Nuseirat massacre and hostage rescue',
    description:
      'Israeli forces stormed Nuseirat refugee camp to free four hostages, killing about 274 Palestinians in a crowded market and camp. Scrutiny fell on whether the nearby US-built aid pier played a role.',
    focus: { lat: 31.4500, lon: 34.3900, zoom: 15, pitch: 45, bearing: 12 },
    casualties: { killed: 274, injured: 698 },   // Gaza Ministry of Health; Israel disputed the toll
    sources: [
      { name: 'Wikipedia — Nuseirat rescue operation', url: 'https://en.wikipedia.org/wiki/Nuseirat_rescue_operation' },
    ],
  },
  {
    date: '2024-10-16',
    title: 'Yahya Sinwar killed',
    description:
      'The Hamas leader and architect of October 7 was killed by Israeli forces in Rafah during a chance encounter, ending months of search.',
    focus: { lat: 31.3000, lon: 34.2500, zoom: 15, pitch: 45, bearing: 18 },
    casualties: { killed: 1 },
    sources: [
      { name: 'Wikipedia — Killing of Yahya Sinwar', url: 'https://en.wikipedia.org/wiki/Killing_of_Yahya_Sinwar' },
    ],
  },
  {
    date: '2024-11-21',
    title: 'ICC arrest warrants for Netanyahu and Gallant',
    description:
      "The International Criminal Court issued arrest warrants for Israel's prime minister Netanyahu and former defence minister Gallant over alleged war crimes and crimes against humanity in Gaza.",
    sources: [
      { name: 'Wikipedia — ICC arrest warrants for Israeli leaders', url: 'https://en.wikipedia.org/wiki/International_Criminal_Court_arrest_warrants_for_Israeli_leaders' },
    ],
  },
  {
    date: '2024-12-27',
    title: 'Kamal Adwan Hospital raided and shut down',
    description:
      'Israeli forces raided Kamal Adwan, the last major hospital still functioning in north Gaza, detaining its director Dr. Hussam Abu Safiya and forcing the facility out of service.',
    focus: { lat: 31.5400, lon: 34.5050, zoom: 16, pitch: 48, bearing: 10 },
    sources: [
      { name: 'Wikipedia — Kamal Adwan Hospital', url: 'https://en.wikipedia.org/wiki/Kamal_Adwan_Hospital' },
    ],
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
    date: '2025-05-27',
    title: 'Killings at Gaza Humanitarian Foundation sites',
    description:
      'After the US- and Israel-backed Gaza Humanitarian Foundation replaced UN aid in May 2025, Israeli forces repeatedly fired on crowds seeking food at its sites — which the UN called "death traps" — killing hundreds.',
    focus: { lat: 31.2950, lon: 34.2450, zoom: 14, pitch: 30, bearing: -12 },
    sources: [
      { name: 'Wikipedia — Gaza Humanitarian Foundation', url: 'https://en.wikipedia.org/wiki/Gaza_Humanitarian_Foundation' },
    ],
  },
  {
    date: '2025-08-22',
    title: 'Famine confirmed in Gaza',
    description:
      'The IPC formally classified Gaza City and surrounding areas as being in famine, with hundreds of thousands more projected to fall into famine conditions in the weeks following.',
  },
  {
    date: '2025-09-15',
    title: 'Main Gaza City offensive begins',
    description:
      'Israel launched its main ground assault on Gaza City after weeks of buildup, displacing hundreds of thousands of residents toward the south.',
    focus: { lat: 31.5240, lon: 34.4500, zoom: 12, pitch: 20, bearing: 0 },
    sources: [
      { name: 'Wikipedia — 2025 Gaza City offensive', url: 'https://en.wikipedia.org/wiki/2025_Gaza_City_offensive' },
    ],
  },
  {
    date: '2025-10-07',
    title: 'Two years of war',
    description:
      'The war passed its two-year mark. Gaza health authorities reported cumulative Palestinian deaths exceeding 67,000, with most of the Strip displaced or destroyed.',
  },
  {
    date: '2025-10-10',
    title: 'Phase-one ceasefire takes effect',
    description:
      'A US-brokered twenty-point peace plan entered its first phase: living hostages and remains exchanged for Palestinian prisoners, a partial IDF withdrawal, and expanded humanitarian aid.',
  },
];
