import chalk from 'chalk';
import readline from 'readline';
import { getPalette } from './palette.js';

const MIN_TERM_WIDTH = 50;
const DEFAULT_FRAME_DELAY = 500; // ms between frames

class AsciiRenderer {
  constructor(options = {}) {
    this.termWidth = options.termWidth || process.stdout.columns || 80;
    this.useColor =
      options.useColor !== undefined ? options.useColor : process.env.NO_COLOR === undefined;
    this.palette = getPalette(options.paletteName);
  }

  render(scene, options = {}) {
    const output = this.renderToString(scene, options);
    if (output) {
      console.log(output);
    }
  }

  // Animate through frames
  // Returns a function to stop the animation
  animate(scene, options = {}) {
    const frameDelay = options.frameDelay || DEFAULT_FRAME_DELAY;
    const onComplete = options.onComplete;

    // Check if scene has animation frames
    if (!scene.getFrames || !scene.frameCount) {
      console.warn('Scene does not support animation, falling back to static');
      this.render(scene, options);
      if (onComplete) onComplete();
      return () => {};
    }

    let frameIndex = 0;
    let animationId;
    let isRunning = true;

    // Use renderToString to avoid duplicating centering/coloring logic
    const renderFrame = () => {
      if (!isRunning) return;

      // Clear previous frame (move up and clear lines)
      const lineCount = scene.height || scene.getArt(0).length;
      readline.cursorTo(
        process.stdout,
        0,
        process.stdout.rows ? process.stdout.rows - lineCount - 1 : 0
      );
      readline.clearScreenDown(process.stdout);

      // Use renderToString for consistent rendering with width check
      const output = this.renderToString(scene, { frameIndex });
      if (output) {
        console.log(output);
      }

      frameIndex = (frameIndex + 1) % scene.frameCount;

      animationId = setTimeout(renderFrame, frameDelay);
    };

    // Start animation
    renderFrame();

    // Return stop function
    return () => {
      isRunning = false;
      if (animationId) {
        clearTimeout(animationId);
      }
    };
  }

  renderToString(scene, options = {}) {
    if (this.termWidth < MIN_TERM_WIDTH) {
      return '';
    }

    const frameIndex = options.frameIndex || 0;
    // Only call getArt if it exists, otherwise use static art
    const getArtFn = scene.getArt || (() => scene.art);
    const lines = getArtFn(frameIndex);
    const pad = Math.max(0, Math.floor((this.termWidth - scene.width) / 2));
    const padding = ' '.repeat(pad);

    const rendered = lines.map((line) => {
      const colored = this.useColor
        ? this.colorLine(line, scene.charColors, this.palette, scene.defaultColor)
        : line;
      return padding + colored;
    });

    return rendered.join('\n');
  }

  colorLine(line, charColors, palette, defaultColorKey) {
    let output = '';
    for (const ch of line) {
      if (ch === ' ') {
        output += ' ';
        continue;
      }
      const key = charColors[ch] || defaultColorKey;
      const hex = palette[key];
      output += hex ? chalk.hex(hex)(ch) : ch;
    }
    return output;
  }
}

export { AsciiRenderer, MIN_TERM_WIDTH };
