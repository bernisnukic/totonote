/** The custom scheme embedded images are served over. */
export const MEDIA_SCHEME = 'totonote';

/** The URL host that routes to the media table. */
export const MEDIA_HOST = 'media';

/** The URL prefix documents use to point at an embedded image. */
export const MEDIA_URL_PREFIX = `${MEDIA_SCHEME}://${MEDIA_HOST}/`;

/** Build the src a document node stores for an image. */
export function mediaUrl(id: string): string {
  return `${MEDIA_URL_PREFIX}${id}`;
}

/** Pull the media id out of a `totonote://media/<id>` url, or null if it isn't one. */
export function mediaIdFromUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return null;
  const id = url.slice(MEDIA_URL_PREFIX.length).split(/[?#/]/)[0];
  return id || null;
}

/**
 * Every media id referenced anywhere in a chunk of stored TipTap JSON.
 *
 * Works on the raw string rather than by walking the tree: image nodes may sit at any
 * depth and a future node type could carry a media url in a different attribute, so
 * matching the url itself can't miss one. Used to decide which images are still in use
 * before purging the rest.
 */
export function mediaIdsInContent(content: string): string[] {
  if (!content) return [];
  const ids = new Set<string>();
  // Ids are UUIDs, but accept any url-safe run so a hand-edited document still matches.
  const pattern = new RegExp(`${MEDIA_URL_PREFIX.replace(/[/]/g, '\\/')}([A-Za-z0-9_-]+)`, 'g');
  for (const match of content.matchAll(pattern)) {
    ids.add(match[1]);
  }
  return [...ids];
}
