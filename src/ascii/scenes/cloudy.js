// Cloudy animation frames - drifting clouds
// 4 frames with cloud positions shifting left/right (all within width 55)
// Frame 0 is the canonical static display (snapshot-tested).

const cloudyFrame0 = [
  '            .-~~~-.                                  ',
  '      .- ~ ~-(       )- ~                            ',
  '     /                     \\      .-~~~-.           ',
  '    |                       |.- ~-(       )- ~       ',
  '     \\                     /                  \\    ',
  '       ~- . _____ . -~      \\                /     ',
  '                               ~- . ___ . -~        ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 1: top cloud shifts right, bottom cloud shifts left
const cloudyFrame1 = [
  '             .-~~~-.                                 ',
  '       .- ~ ~-(       )- ~                           ',
  '      /                     \\     .-~~~-.           ',
  '     |                       |.- ~-(       )- ~      ',
  '      \\                     /                  \\   ',
  '        ~- . _____ . -~      \\                /     ',
  '                                ~- . ___ . -~        ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 2: clouds shift further in same direction
const cloudyFrame2 = [
  '              .-~~~-.                                ',
  '        .- ~ ~-(       )- ~                          ',
  '       /                     \\    .-~~~-.           ',
  '      |                       |.- ~-(       )- ~     ',
  '       \\                     /                  \\  ',
  '         ~- . _____ . -~      \\                /     ',
  '                                 ~- . ___ . -~        ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

// Frame 3: clouds drift back (slightly past center)
const cloudyFrame3 = [
  '             .-~~~-.                                 ',
  '       .- ~ ~-(       )- ~                           ',
  '      /                     \\     .-~~~-.           ',
  '     |                       |.- ~-(       )- ~      ',
  '      \\                     /                  \\   ',
  '        ~- . _____ . -~      \\                /     ',
  '                                ~- . ___ . -~        ',
  '           ( _ _._                                   ',
  "          |_|-'_~_`-._                              ",
  "       .-'-_~_-~_-~-_`-._                           ",
  '   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                     ',
  '   | []  []   ___   []  [] |_._._._._.               ',
  '   |_________|___|__________|=|=|=|=|=|              '
];

const frames = [cloudyFrame0, cloudyFrame1, cloudyFrame2, cloudyFrame3];

export default {
  name: 'cloudy',
  width: 55,
  height: cloudyFrame0.length,
  defaultColor: 'cloudDark',
  charColors: {
    '-': 'cloud',
    '.': 'cloud',
    '(': 'cloud',
    ')': 'cloud',
    '~': 'ground',
    '/': 'cloud',
    '\\': 'cloud',
    '[': 'houseWindow',
    ']': 'houseWindow',
    _: 'houseWall',
    '=': 'houseDoor',
    '|': 'houseWall',
    "'": 'houseWall'
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
