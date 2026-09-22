import { useState, useEffect, useCallback } from "react";

export interface LikedShowItem {
  showId: string;
  title: string;
  hostName: string;
  coverArtUrl: string;
  genre?: string;
  matchScore?: number;
  whyYouWillLikeIt?: string;
  recommendationReason?: string;
  likedAt: number;
}

const STORAGE_KEY = "discopod_liked_shows_v1";
const EVENT_NAME = "discopod:liked_shows_changed";

function readFromStorage(): LikedShowItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to read liked shows from localStorage:", err);
  }
  return [];
}

function writeToStorage(items: LikedShowItem[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch (err) {
    console.warn("Failed to save liked shows to localStorage:", err);
  }
}

export function getLikedShows(): LikedShowItem[] {
  return readFromStorage();
}

export function addLikedShow(show: Omit<LikedShowItem, "likedAt">): void {
  const current = readFromStorage();
  // Don't add duplicate, but update if it exists
  const filtered = current.filter((item) => item.showId !== show.showId);
  const updated: LikedShowItem = {
    ...show,
    likedAt: Date.now(),
  };
  writeToStorage([updated, ...filtered]);
}

export function removeLikedShow(showId: string): void {
  const current = readFromStorage();
  const filtered = current.filter((item) => item.showId !== showId);
  writeToStorage(filtered);
}

export function clearLikedShows(): void {
  writeToStorage([]);
}

export function isLikedShow(showId: string): boolean {
  const current = readFromStorage();
  return current.some((item) => item.showId === showId);
}

export function useLikedShows() {
  const [likedShows, setLikedShows] = useState<LikedShowItem[]>(() => readFromStorage());

  useEffect(() => {
    // Initial sync
    setLikedShows(readFromStorage());

    function handleUpdate() {
      setLikedShows(readFromStorage());
    }

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const removeLiked = useCallback((showId: string) => {
    removeLikedShow(showId);
  }, []);

  const clearAll = useCallback(() => {
    clearLikedShows();
  }, []);

  return {
    likedShows,
    count: likedShows.length,
    removeLiked,
    clearAll,
  };
}
