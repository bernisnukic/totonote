import { describe, it, expect } from 'vitest';
import { findLinkTrigger } from './link-trigger';

describe('spotting a link being typed', () => {
  it('fires as soon as the brackets are typed', () => {
    expect(findLinkTrigger('See [[')).toEqual({ query: '', length: 2 });
  });

  it('reports what has been typed so far', () => {
    expect(findLinkTrigger('See [[Gur')).toEqual({ query: 'Gur', length: 5 });
  });

  it('allows spaces, because document titles have them', () => {
    expect(findLinkTrigger('[[The Ancient Age')).toEqual({ query: 'The Ancient Age', length: 17 });
  });

  it('does not fire without the brackets', () => {
    expect(findLinkTrigger('just writing')).toBeNull();
    expect(findLinkTrigger('one [ bracket')).toBeNull();
  });

  it('stops once the link is closed', () => {
    expect(findLinkTrigger('[[Gura]]')).toBeNull();
    expect(findLinkTrigger('[[Gura] ')).toBeNull();
  });

  it('uses the most recent brackets when there are several', () => {
    expect(findLinkTrigger('[[Gura]] then [[Pek')).toEqual({ query: 'Pek', length: 5 });
  });

  it('gives up once what follows is clearly not a title', () => {
    expect(findLinkTrigger(`[[${'x'.repeat(200)}`)).toBeNull();
  });

  it('does not carry across a line break', () => {
    expect(findLinkTrigger('[[Gura\nnext line')).toBeNull();
  });
});
