export interface SecureValueStore {
  /** False when the platform cannot provide hardware-backed secure storage (web). */
  isPersistent: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
