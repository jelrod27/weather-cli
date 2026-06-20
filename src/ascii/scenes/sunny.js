// Sunny animation frames - pulsing sun rays
// 4 frames with ray rotation and subtle sun pulse (all within width 55)
// Frame 0 is the canonical static display (snapshot-tested).

const sunnyFrame0 = [
  '       \\   |   /                                    ',
  '        .---.                                        ',
  '     --( o o )--                                     ',
  "        `---'            .-~~~-.                     ",
  '       /   |   \\   .- ~ ~-(       )- ~              ',
  '                   /                     \\           ',
  '                          ~                            ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 1: rays swap direction (mirror), sun squints
const sunnyFrame1 = [
  '       /   |   \\                                    ',
  '        .---.                                        ',
  '     --( - - )--                                     ',
  "        `---'            .-~~~-.                     ",
  '       \\   |   /   .- ~ ~-(       )- ~              ',
  '                   /                     \\           ',
  '                          ~                            ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 2: rays spread wider, sun opens eyes
const sunnyFrame2 = [
  '      \\    |    /                                    ',
  '        .---.                                        ',
  '     --( o o )--                                     ',
  "        `---'            .-~~~-.                     ",
  '       /    |    \\   .- ~ ~-(       )- ~              ',
  '                   /                     \\           ',
  '                          ~                            ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 3: rays swap back, sun squints again
const sunnyFrame3 = [
  '      /    |    \\                                    ',
  '        .---.                                        ',
  '     --( - - )--                                     ',
  "        `---'            .-~~~-.                     ",
  '       \\    |    /   .- ~ ~-(       )- ~              ',
  '                   /                     \\           ',
  '                          ~                            ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

const frames = [sunnyFrame0, sunnyFrame1, sunnyFrame2, sunnyFrame3];

export default {
  name: 'sunny',
  width: 55,
  height: sunnyFrame0.length,
  defaultColor: 'sky',
  charColors: {
    '\\': 'sunRay',
    '/': 'sunRay',
    '|': 'sunRay',
    '-': 'sun',
    '.': 'sun',
    '(': 'sun',
    ')': 'sun',
    o: 'sun',
    '`': 'sun',
    "'": 'sun',
    '~': 'ground',
    '[': 'houseWindow',
    ']': 'houseWindow',
    _: 'houseWall',
    '^': 'ground',
    '=': 'houseDoor'
  },
  // Return all frames for animation
  getFrames() {
    return frames;
  },
  // Return single frame for static display
  // Accepts frameIndex (number) or options object for backwards compatibility
  getArt(frameIndexOrOptions = 0) {
    const frameIndex = typeof frameIndexOrOptions === 'number' ? frameIndexOrOptions : 0;
    return frames[frameIndex % frames.length];
  },
  frameCount: frames.length
};
