// Light and colour for each time of day and for the storm: sky gradient, sun, ambient,
// fog, water tint. One painterly palette so terrain and sky always belong together.

export const TIMES = {
  morning: {
    label: 'Morning', skyTop: 0x5d8fd0, skyHorizon: 0xf6d6b0, fog: 0xd9d2c4, sun: 0xfff0d0, sunIntensity: 2.4,
    sunDir: [-0.55, 0.32, 0.55], hemiSky: 0xbcd4f0, hemiGround: 0x6b5a40, hemiIntensity: 1.25,
    water: 0x2f7d95, waterDeep: 0x1d5470, stars: 0, windows: 0, sunDisc: 0xfff3c8,
  },
  day: {
    label: 'Midday', skyTop: 0x3f7fd6, skyHorizon: 0xcfe4f2, fog: 0xc7dbe6, sun: 0xffffff, sunIntensity: 2.6,
    sunDir: [0.35, 0.82, 0.3], hemiSky: 0xd0e6ff, hemiGround: 0x5f6a40, hemiIntensity: 1.35,
    water: 0x2a87a8, waterDeep: 0x175a80, stars: 0, windows: 0, sunDisc: 0xffffff,
  },
  dusk: {
    label: 'Dusk', skyTop: 0x3a3f78, skyHorizon: 0xff9a5a, fog: 0xc98c73, sun: 0xffa060, sunIntensity: 2.0,
    sunDir: [0.7, 0.12, 0.55], hemiSky: 0x9a88c8, hemiGround: 0x4a3020, hemiIntensity: 0.95,
    water: 0x3c5c82, waterDeep: 0x22385c, stars: 0.25, windows: 0.7, sunDisc: 0xffc070,
  },
  night: {
    label: 'Night', skyTop: 0x050a1c, skyHorizon: 0x1c2a4c, fog: 0x0e1628, sun: 0x8fa8ff, sunIntensity: 0.55,
    sunDir: [-0.3, 0.6, -0.5], hemiSky: 0x3a4a80, hemiGround: 0x101018, hemiIntensity: 0.45,
    water: 0x101e38, waterDeep: 0x08101f, stars: 1, windows: 1, sunDisc: 0xdfe8ff,
  },
  storm: {
    label: 'Squall', skyTop: 0x3a4248, skyHorizon: 0x7b8790, fog: 0x6c767e, sun: 0xc8d0d8, sunIntensity: 0.9,
    sunDir: [0.2, 0.7, 0.4], hemiSky: 0x9aa4ac, hemiGround: 0x303428, hemiIntensity: 1.0,
    water: 0x3a5560, waterDeep: 0x223640, stars: 0, windows: 0.5, sunDisc: 0x9aa4ac,
  },
};

export function timeOf(id) {
  return TIMES[id] ?? TIMES.day;
}
