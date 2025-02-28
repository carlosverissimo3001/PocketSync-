import { Prisma } from '@prisma/client';
import { buildSampleItem, ListItem } from './list-item.entity';
import { v4 as uuidv4 } from 'uuid';
export class List {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  items: ListItem[];
  updatedAt: Date;
  deleted: boolean;
  lastEditorUsername?: string;
}

export const buildSampleList = (userId: string): Prisma.ListCreateInput => ({
  id: uuidv4(),
  name: 'Created with ❤️ by the server',
  owner: { connect: { id: userId } },
  items: { create: [buildSampleItem()] },
  createdAt: new Date('2023-11-16'), // Don't ask me why I chose this date.
  updatedAt: new Date('2023-11-16'),
  deleted: false,
});

export const buildListToPrisma = (list: List): Prisma.ListCreateInput => ({
  id: list.id,
  name: list.name,
  owner: { connect: { id: list.ownerId } },
  createdAt: list.createdAt,
  updatedAt: list.updatedAt,
  deleted: list.deleted ?? false,
  lastEditorUsername: list.lastEditorUsername,
  items: {
    create: list.items.map((item) => buildListItemToPrisma(item)),
  },
});

export const buildListItemToPrisma = (item: ListItem) => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  checked: item.checked,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  deleted: item.deleted ?? false,
  lastEditorUsername: item.lastEditorUsername,
});

export const buildChangesToPrisma = (
  change: Prisma.JsonValue,
  requesterId: string,
): Prisma.ListUpdateInput => {
  // Parse the JSON string if it's a string
  const listData = typeof change === 'string' ? JSON.parse(change) : change;

  return {
    name: listData.name,
    lastEditorUsername: requesterId,
    updatedAt: listData.updatedAt,
    deleted: listData.deleted ?? false,
    items: {
      deleteMany: {}, // Clear existing items
      create:
        listData.items?.map((item: ListItem) => buildListItemToPrisma(item)) ||
        [],
    },
  };
};
