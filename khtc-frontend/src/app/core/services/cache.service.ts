// ============================================
// Cache Service — In-memory + localStorage cache
// ============================================
import { Injectable } from '@angular/core';

interface CacheEntry<T> {
    data: T;
    expiry: number;
}

@Injectable({ providedIn: 'root' })
export class CacheService {
    private memoryCache = new Map<string, CacheEntry<any>>();

    /** Get from memory cache */
    get<T>(key: string): T | null {
        const entry = this.memoryCache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.memoryCache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    /** Set to memory cache with TTL in seconds */
    set<T>(key: string, data: T, ttlSeconds: number = 300): void {
        this.memoryCache.set(key, {
            data,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    /** Remove from cache */
    remove(key: string): void {
        this.memoryCache.delete(key);
    }

    /** Clear all cache */
    clear(): void {
        this.memoryCache.clear();
    }

    /** Get or compute — cache miss will call the factory */
    async getOrCompute<T>(key: string, factory: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) return cached;

        const data = await factory();
        this.set(key, data, ttlSeconds);
        return data;
    }
}
