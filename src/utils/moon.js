/**
 * Moon phase calculator — pure astronomical math, no API dependency.
 * Algorithm: Julian date -> synodic period -> phase angle -> illumination.
 */

/**
 * Calculate the current moon phase for a given date.
 * @param {Date} [date=new Date()] - The date to calculate the moon phase for.
 * @returns {{phase: number, illumination: number, name: string, emoji: string}}
 */
export function getMoonPhase(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Julian date calculation
  const jd =
    367 * year -
    Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4) -
    Math.floor((3 * (Math.floor((year + (month - 9) / 7) / 100) + 1)) / 4) +
    Math.floor((275 * month) / 9) +
    day +
    1721028.5 +
    (date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) / 24;

  // Known new moon: 2000-01-06 18:14 UTC = JD 2451550.1
  const knownNewMoon = 2451550.1;
  const synodicMonth = 29.53059; // days

  // Phase: 0 = new moon, 0.5 = full moon, approaching 1 = next new moon
  let phase = ((jd - knownNewMoon) % synodicMonth) / synodicMonth;
  if (phase < 0) phase += 1;

  // Illumination: fraction of moon face illuminated (0-1, then *100 for percent)
  // illumination = (1 - cos(2*pi*phase)) / 2
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);

  // Phase name and emoji
  const phases = [
    { name: 'New Moon', emoji: '\u{1F311}' },
    { name: 'Waxing Crescent', emoji: '\u{1F312}' },
    { name: 'First Quarter', emoji: '\u{1F313}' },
    { name: 'Waxing Gibbous', emoji: '\u{1F314}' },
    { name: 'Full Moon', emoji: '\u{1F315}' },
    { name: 'Waning Gibbous', emoji: '\u{1F316}' },
    { name: 'Last Quarter', emoji: '\u{1F317}' },
    { name: 'Waning Crescent', emoji: '\u{1F318}' }
  ];

  const phaseIndex = Math.floor(phase * 8 + 0.5) % 8;

  return {
    phase, // 0-1
    illumination, // 0-100 (percentage)
    name: phases[phaseIndex].name,
    emoji: phases[phaseIndex].emoji
  };
}
