/**
 * Modul manajemen state sesi pengguna dan idempotensi Telegram update_id
 */

/**
 * Membuat state sesi kosong awal
 */
export function createInitialState() {
  return {
    step: 'IDLE',
    machine: null,
    sourceCoil: null,
    materialCode: null,
    material: null,
    specification: null,
    count: null,
    startDigit: null,
    generatedCoils: [],
    inspections: [],
    
    // Pointer loop input data per coil
    currentCoilIndex: 0,
    currentCoilData: {},
    
    // Data edit sementara
    editTarget: null // { coilIndex?: number, field?: string }
  };
}

class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(userId) {
    const key = String(userId);
    if (!this.sessions.has(key)) {
      this.sessions.set(key, createInitialState());
    }
    return this.sessions.get(key);
  }

  set(userId, updates) {
    const key = String(userId);
    const current = this.get(key);
    const updated = { ...current, ...updates };
    this.sessions.set(key, updated);
    return updated;
  }

  clear(userId) {
    const key = String(userId);
    this.sessions.delete(key);
  }

  has(userId) {
    return this.sessions.has(String(userId));
  }
}

class IdempotencyCache {
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
    this.processedIds = new Set();
    this.orderQueue = [];
  }

  has(updateId) {
    if (updateId === undefined || updateId === null) return false;
    return this.processedIds.has(Number(updateId));
  }

  add(updateId) {
    if (updateId === undefined || updateId === null) return;
    const id = Number(updateId);
    if (this.processedIds.has(id)) return;

    this.processedIds.add(id);
    this.orderQueue.push(id);

    if (this.orderQueue.length > this.maxSize) {
      const oldest = this.orderQueue.shift();
      this.processedIds.delete(oldest);
    }
  }

  clear() {
    this.processedIds.clear();
    this.orderQueue = [];
  }
}

export const sessions = new SessionStore();
export const idempotencyCache = new IdempotencyCache();
