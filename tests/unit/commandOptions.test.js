import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { registerAll } from '../../src/commands/index.js';

async function captureParsedOptions(argv) {
  const program = new Command().name('weather');
  registerAll(program);

  let parsed;
  const stopBeforeAction = new Error('stop before command action');
  program.hook('preAction', (_parentCommand, actionCommand) => {
    parsed = {
      commandName: actionCommand.name(),
      commandOptions: actionCommand.opts(),
      rootOptions: program.opts()
    };
    throw stopBeforeAction;
  });

  await expect(program.parseAsync(argv, { from: 'user' })).rejects.toBe(stopBeforeAction);
  return parsed;
}

describe('CLI option ownership', () => {
  it('passes options after a subcommand to that subcommand', async () => {
    const parsed = await captureParsedOptions([
      'now',
      'London',
      '--fahrenheit',
      '--json',
      '--art-style',
      'retro'
    ]);

    expect(parsed.commandName).toBe('now');
    expect(parsed.commandOptions).toMatchObject({
      fahrenheit: true,
      json: true,
      artStyle: 'retro'
    });
    expect(parsed.rootOptions).toEqual({ units: 'auto' });
  });

  it('keeps root shorthand options available without a subcommand', async () => {
    const parsed = await captureParsedOptions(['London', '--fahrenheit', '--json']);

    expect(parsed.commandOptions).toMatchObject({ fahrenheit: true, json: true });
    expect(parsed.rootOptions).toMatchObject({ fahrenheit: true, json: true });
  });

  it('assigns options before a subcommand to the root command', async () => {
    const parsed = await captureParsedOptions(['--fahrenheit', '--json', 'now', 'London']);

    expect(parsed.commandName).toBe('now');
    expect(parsed.rootOptions).toMatchObject({ fahrenheit: true, json: true });
    expect(parsed.commandOptions).toEqual({ units: 'auto' });
  });
});
