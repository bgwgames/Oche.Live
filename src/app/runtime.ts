/**
 * The live-sync backend. Today this is the claude.ai Artifact runtime (`window.claude`): a document
 * store for the shared game and a room for presence between phones. It is isolated here so it can be
 * replaced by Firebase without touching the engine or the UI.
 */

export interface DbError {
  code?: string;
}

export interface Snapshot<T> {
  exists: boolean;
  data(): T;
  metadata: { fromCache: boolean };
}

export interface DocRef<T> {
  get(): Promise<Snapshot<T>>;
  set(data: T): Promise<void>;
  onSnapshot(next: (s: Snapshot<T>) => void, error?: (e: DbError) => void): () => void;
}

export interface Db {
  doc<T = unknown>(path: string): DocRef<T>;
}

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface Peer {
  sameTab: boolean;
  presence: Readonly<Record<string, Json>> | null;
}

export interface JoinedRoom {
  presence(patch: Record<string, Json | null>): Promise<void>;
  onPeers(fn: (change: { peers: Peer[] }) => void): void;
  leave(): Promise<void>;
}

export interface Room {
  join(name: string): Promise<JoinedRoom>;
}

export interface User {
  can(capability: string): Promise<boolean | null>;
}

export interface Runtime {
  db: Db | null;
  room: Room | null;
  user: User | null;
}

interface ClaudeGlobal {
  use?(name: string): Promise<unknown>;
}

/** Connects to whatever the page is allowed to use. Each capability is null when unavailable. */
export async function connectRuntime(): Promise<Runtime> {
  const C = (window as unknown as { claude?: ClaudeGlobal }).claude;
  const use = <T>(n: string): Promise<T | null> =>
    C && C.use ? (C.use(n) as Promise<T>).catch(() => null) : Promise.resolve(null);
  const [db, room, user] = await Promise.all([use<Db>('db'), use<Room>('room'), use<User>('user')]);
  return { db, room, user };
}
