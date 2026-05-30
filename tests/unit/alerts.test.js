import { describe, it, expect } from 'vitest';
import { sortAlerts, SEVERITY_ORDER, URGENCY_ORDER } from '../../src/api/alerts.js';

describe('sortAlerts', () => {
  const makeAlert = (event, severity, urgency) => ({
    event,
    headline: event,
    severity,
    urgency,
    description: `${severity} ${event}`,
    effective: null,
    expires: null,
    areaDesc: 'Test Area'
  });

  it('sorts by severity: Extreme first, Minor last', () => {
    const alerts = [
      makeAlert('Flood', 'Minor', 'Expected'),
      makeAlert('Tornado', 'Extreme', 'Immediate'),
      makeAlert('Storm', 'Severe', 'Expected'),
      makeAlert('Wind', 'Moderate', 'Expected')
    ];

    const sorted = sortAlerts(alerts);
    expect(sorted[0].severity).toBe('Extreme');
    expect(sorted[1].severity).toBe('Severe');
    expect(sorted[2].severity).toBe('Moderate');
    expect(sorted[3].severity).toBe('Minor');
  });

  it('sorts by urgency when severity is equal', () => {
    const alerts = [
      makeAlert('Wind Advisory', 'Moderate', 'Expected'),
      makeAlert('Storm Warning', 'Moderate', 'Immediate'),
      makeAlert('Flood Watch', 'Moderate', 'Future')
    ];

    const sorted = sortAlerts(alerts);
    expect(sorted[0].urgency).toBe('Immediate');
    expect(sorted[1].urgency).toBe('Expected');
    expect(sorted[2].urgency).toBe('Future');
  });

  it('returns a new array without mutating the original', () => {
    const alerts = [makeAlert('A', 'Minor', 'Expected'), makeAlert('B', 'Severe', 'Expected')];
    const sorted = sortAlerts(alerts);
    expect(sorted).not.toBe(alerts);
    expect(alerts[0].severity).toBe('Minor');
  });

  it('handles empty array', () => {
    expect(sortAlerts([])).toEqual([]);
  });

  it('handles unknown severity gracefully', () => {
    const alerts = [
      makeAlert('Unknown', 'Unknown', 'Expected'),
      makeAlert('Severe', 'Severe', 'Immediate')
    ];
    const sorted = sortAlerts(alerts);
    expect(sorted[0].severity).toBe('Severe');
    expect(sorted[1].severity).toBe('Unknown');
  });
});

describe('SEVERITY_ORDER', () => {
  it('has correct severity ordering', () => {
    expect(SEVERITY_ORDER).toEqual(['Minor', 'Moderate', 'Severe', 'Extreme']);
  });
});

describe('URGENCY_ORDER', () => {
  it('has correct urgency ordering', () => {
    expect(URGENCY_ORDER).toEqual(['Past', 'Future', 'Expected', 'Immediate']);
  });
});
