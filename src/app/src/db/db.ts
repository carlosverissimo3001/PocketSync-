import Dexie, { Table } from "dexie";
import { List, ListItem } from "@/types/list.types";
import { v4 as uuidv4 } from 'uuid';

type ListWithoutItems = Omit<List, 'items'>;

export class ShoppingListDB extends Dexie {
  lists!: Table<ListWithoutItems>; 
  items!: Table<ListItem>; 
  serverSyncs!: Table<{
    id: string;
    listLength: number;
    lastSync: Date;
  }>;

  constructor(userId: string) {
    super(`ShoppingListDB_${userId}`);
    this.version(1).stores({
      lists: "id, name, ownerId, createdAt, updatedAt, deleted, lastEditorId",
      items: "id, listId, name, quantity, checked, createdAt, updatedAt, deleted, lastEditorId",
      serverSyncs: "id, lastSync, listLength",
    });
  }
}

let currentDB: ShoppingListDB | null = null;

export const initializeDB = (userId: string) => {
  currentDB = new ShoppingListDB(userId);
  return currentDB;
};

export const closeDB = async () => {
  if (currentDB) {
    currentDB.close();
    currentDB = null;
  }
};

export const getCurrentDB = (userId?: string) => {
  if (!currentDB) {
    if (!userId) {
      throw new Error('Database not initialized and no userId provided to initialize it.');
    }
    currentDB = initializeDB(userId);
  }
  return currentDB;
};

// Export everything needed
export type { ListWithoutItems };
