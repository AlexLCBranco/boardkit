import { useEffect } from "react";
import { create } from "zustand";

import { loadImage, onImageChanged } from "./imageStore";

/**
 * Turns a stored image into a URL a page can draw, once per image per
 * session.
 *
 * Many components want the same picture at once (the backdrop, the toolbar
 * that reads its tone), and a board switch would otherwise reload it from
 * IndexedDB every time, so the result is cached. `null` means "looked, and it
 * is not there" -- distinct from `undefined`, "not looked yet" -- so a missing
 * image is asked for once and the board falls back to the theme's background.
 */
interface ImageUrlState {
  readonly urls: Readonly<Record<string, string | null>>;
}

const useImageUrlStore = create<ImageUrlState>(() => ({ urls: {} }));
const loading = new Set<string>();

function ensureImageUrl(id: string): void {
  if (useImageUrlStore.getState().urls[id] !== undefined || loading.has(id)) {
    return;
  }
  loading.add(id);
  void loadImage(id).then((blob) => {
    loading.delete(id);
    useImageUrlStore.setState((state) => ({
      urls: { ...state.urls, [id]: blob ? URL.createObjectURL(blob) : null },
    }));
  });
}

/** Drops the cached URL (and frees it), so the next look re-reads the store. */
export function forgetImageUrl(id: string): void {
  const url = useImageUrlStore.getState().urls[id];
  if (url === undefined) {
    return;
  }
  if (url !== null) {
    URL.revokeObjectURL(url);
  }
  useImageUrlStore.setState((state) => {
    const { [id]: _dropped, ...rest } = state.urls;
    return { urls: rest };
  });
}

onImageChanged(forgetImageUrl);

/**
 * The URL for an image: a string once loaded, `null` if the image is missing,
 * `undefined` while loading or when `id` is `undefined`.
 */
export function useImageUrl(id: string | undefined): string | null | undefined {
  const url = useImageUrlStore((state) => (id === undefined ? undefined : state.urls[id]));
  useEffect(() => {
    if (id !== undefined) {
      ensureImageUrl(id);
    }
  }, [id, url]);
  return url;
}
