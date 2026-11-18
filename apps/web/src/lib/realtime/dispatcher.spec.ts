import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDispatcher, NON_DEDUPED_EVENTS } from './dispatcher';
import { clearHandlers, registerHandlers, type RealtimeHandlerContext } from './handlers';
import { clearMutations, registerMutation } from './mutation-registry';
import { clearRipples, useRippleStore } from './ripple-store';

import type { RealtimeEnvelope, RealtimeEventName } from '@hogaria/shared';

const ME = 'user-me';
const OTHER = 'user-other';
const GROUP = 'group-1';

function envelope(event: RealtimeEventName, overrides: Partial<RealtimeEnvelope> = {}): RealtimeEnvelope {
  return { event, groupId: GROUP, actorId: OTHER, clientMutationId: null, at: '2026-11-18T10:00:00.000Z', data: { id: 'x' }, ...overrides };
}

describe('dispatcher (RN-03-17 y RN-03-19)', () => {
  let queryClient: QueryClient;
  let dispatch: (payload: unknown) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    dispatch = createDispatcher({ queryClient, getMeId: () => ME });
    clearHandlers();
    clearMutations();
    clearRipples();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('llama al manejador del evento con el sobre y el contexto', () => {
    const handler = vi.fn();
    registerHandlers({ 'task.updated': handler });
    const env = envelope('task.updated');
    dispatch(env);
    expect(handler).toHaveBeenCalledWith(env, expect.objectContaining({ queryClient, meId: ME }));
  });

  it('descarta los eventos de mutaciones propias', () => {
    const handler = vi.fn();
    registerHandlers({ 'task.updated': handler });
    registerMutation('mut-1');
    dispatch(envelope('task.updated', { clientMutationId: 'mut-1' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(NON_DEDUPED_EVENTS)('%s se aplica aunque sea de una mutación propia', (event) => {
    expect(NON_DEDUPED_EVENTS).toEqual(['activity.created', 'ai.quota.updated']);
    const handler = vi.fn();
    registerHandlers({ [event]: handler });
    registerMutation('mut-1');
    dispatch(envelope(event, { clientMutationId: 'mut-1' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignora eventos sin manejador, desconocidos o mal formados', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(() => dispatch(envelope('recipe.created'))).not.toThrow();
    expect(() => dispatch({ ...envelope('recipe.created'), event: 'task.exploded' })).not.toThrow();
    expect(() => dispatch(null)).not.toThrow();
    expect(() => dispatch('hola')).not.toThrow();
    debug.mockRestore();
  });

  it('un manejador que lanza no rompe el despacho', () => {
    const error = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerHandlers({
      'task.updated': () => {
        throw new Error('boom');
      },
    });
    expect(() => dispatch(envelope('task.updated'))).not.toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('varios manejadores del mismo evento: todos, en orden, sin duplicar la misma función', () => {
    const calls: string[] = [];
    const first = () => void calls.push('a');
    const second = () => void calls.push('b');
    registerHandlers({ 'task.updated': first });
    registerHandlers({ 'task.updated': second });
    registerHandlers({ 'task.updated': first });
    dispatch(envelope('task.updated'));
    expect(calls).toEqual(['a', 'b']);
  });

  it('si un manejador de varios falla, los demás se ejecutan igualmente', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const after = vi.fn();
    registerHandlers({
      'task.updated': () => {
        throw new Error('boom');
      },
    });
    registerHandlers({ 'task.updated': after });
    dispatch(envelope('task.updated'));
    expect(after).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  describe('markRipple del contexto', () => {
    function rippleFor(env: RealtimeEnvelope) {
      registerHandlers({ [env.event]: (_e: RealtimeEnvelope, ctx: RealtimeHandlerContext) => ctx.markRipple('task:x') });
      dispatch(env);
      return useRippleStore.getState().ripples['task:x'];
    }

    it('cambio de otro miembro → onda con su color de calle desde la caché de miembros', () => {
      queryClient.setQueryData(['group', GROUP, 'members'], [
        { userId: ME, laneColor: 'CORAL' },
        { userId: OTHER, laneColor: 'LEAF' },
      ]);
      expect(rippleFor(envelope('task.updated'))?.laneColor).toBe('LEAF');
    });

    it('sin miembros en caché → onda sin color (usa el primario)', () => {
      expect(rippleFor(envelope('task.created'))).toMatchObject({ laneColor: null });
    });

    it('sin onda para el propio usuario (otro dispositivo)', () => {
      expect(rippleFor(envelope('task.updated', { actorId: ME }))).toBeUndefined();
    });

    it('sin onda para eventos de sistema', () => {
      expect(rippleFor(envelope('task.updated', { actorId: null }))).toBeUndefined();
    });

    it('sin onda en borrados', () => {
      expect(rippleFor(envelope('task.deleted'))).toBeUndefined();
      expect(rippleFor(envelope('shopping.items.bulk_deleted'))).toBeUndefined();
    });
  });
});
