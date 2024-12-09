import { List, ListItem } from "@/types/list.types";
import { getCurrentDB } from "./db";

export const fetchListsWithItems = async () => {
  const db = getCurrentDB();
  const lists = await db.lists.toArray();
  const listsWithItems = await Promise.all(
    lists.map(async (list) => ({
      ...list,
      items: await db.items
        .where("listId")
        .equals(list.id)
        .toArray()
    }))
  );
  return listsWithItems;
};

export const createList = async (list: List) => {
  const db = getCurrentDB();
  await db.lists.add(list);
};

export const updateList = async (list: List) => {
  const db = getCurrentDB();
  await db.transaction('rw', db.lists, db.items, async () => {
    const { items, ...listWithoutItems } = list;
    
    await db.items.where('listId').equals(list.id).delete();
    await db.lists.put(listWithoutItems);
    
    if (items?.length) {
      await Promise.all(
        items.map(item => db.items.put(item))
      );
    }
  });
};

export const deleteList = async (listId: string) => {
  const db = getCurrentDB();
  await db.transaction("rw", db.lists, db.items, async () => {
    await db.items
      .where("listId")
      .equals(listId)
      .modify({ deleted: true, updatedAt: new Date() });
    
    await db.lists
      .where('id')
      .equals(listId)
      .modify({ deleted: true, updatedAt: new Date() });
  });
};

export const getLastSync = async () => {
  const db = getCurrentDB();
  return db.serverSyncs.orderBy("lastSync").last();
};
