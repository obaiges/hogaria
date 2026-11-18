import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRipples, markRipple, RIPPLE_DURATION_MS, useRipple } from './ripple-store';

describe('ripple-store (RN-03-19)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRipples();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marca la entidad con el color durante 1 000 ms', () => {
    expect(RIPPLE_DURATION_MS).toBe(1_000);
    const { result } = renderHook(() => useRipple('task:1'));
    expect(result.current).toEqual({ active: false, laneColor: null });

    act(() => markRipple('task:1', 'SEA'));
    expect(result.current).toEqual({ active: true, laneColor: 'SEA' });

    act(() => vi.advanceTimersByTime(999));
    expect(result.current.active).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual({ active: false, laneColor: null });
  });

  it('solo afecta a su clave', () => {
    const other = renderHook(() => useRipple('task:2'));
    act(() => markRipple('task:1', 'CORAL'));
    expect(other.result.current.active).toBe(false);
  });

  it('una marca nueva sobre la misma clave reinicia la duración', () => {
    const { result } = renderHook(() => useRipple('task:1'));
    act(() => markRipple('task:1', 'SEA'));
    act(() => vi.advanceTimersByTime(600));
    act(() => markRipple('task:1', 'SUN'));
    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toEqual({ active: true, laneColor: 'SUN' });
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.active).toBe(false);
  });
});
