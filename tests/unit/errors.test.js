import { describe, it, expect } from 'vitest';
import { WeatherError, mapErrorToExitCode, ERROR_CODES } from '../../src/utils/errors.js';

describe('WeatherError', () => {
  it('creates an error with message and code', () => {
    const error = new WeatherError('test message', 'NETWORK_ERROR');
    expect(error.message).toBe('test message');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.name).toBe('WeatherError');
    expect(error.statusCode).toBeNull();
  });

  it('creates an error with statusCode', () => {
    const error = new WeatherError('not found', 'LOCATION_NOT_FOUND', 404);
    expect(error.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const error = new WeatherError('test', 'NETWORK_ERROR');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WeatherError);
  });
});

describe('mapErrorToExitCode', () => {
  it('maps LOCATION_NOT_FOUND to exit code 3', () => {
    const error = new WeatherError('msg', ERROR_CODES.LOCATION_NOT_FOUND);
    expect(mapErrorToExitCode(error)).toBe(3);
  });

  it('maps NETWORK_ERROR to exit code 4', () => {
    const error = new WeatherError('msg', ERROR_CODES.NETWORK_ERROR);
    expect(mapErrorToExitCode(error)).toBe(4);
  });

  it('maps RATE_LIMIT to exit code 5', () => {
    const error = new WeatherError('msg', ERROR_CODES.RATE_LIMIT);
    expect(mapErrorToExitCode(error)).toBe(5);
  });

  it('maps INVALID_INPUT to exit code 6', () => {
    const error = new WeatherError('msg', ERROR_CODES.INVALID_INPUT);
    expect(mapErrorToExitCode(error)).toBe(6);
  });

  it('maps unknown WeatherError codes to exit code 1', () => {
    const error = new WeatherError('msg', 'UNKNOWN_CODE');
    expect(mapErrorToExitCode(error)).toBe(1);
  });

  it('maps non-WeatherError to exit code 1', () => {
    expect(mapErrorToExitCode(new Error('generic'))).toBe(1);
  });
});

describe('ERROR_CODES', () => {
  it('contains all expected codes', () => {
    expect(ERROR_CODES.LOCATION_NOT_FOUND).toBe('LOCATION_NOT_FOUND');
    expect(ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ERROR_CODES.RATE_LIMIT).toBe('RATE_LIMIT');
    expect(ERROR_CODES.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ERROR_CODES.CACHE_ERROR).toBe('CACHE_ERROR');
  });
});
