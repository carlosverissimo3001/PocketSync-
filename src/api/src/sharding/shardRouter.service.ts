// src/sharding/shardRouter.service.ts

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { HashRing } from './hashRing'; // Ensure this is correctly implemented
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

interface ShardInfo {
  name: string;
  connectionUrl: string;
}

@Injectable()
export class ShardRouterService implements OnModuleInit, OnModuleDestroy {
  private hashRing: HashRing;
  public shardClients: Record<string, PrismaClient> = {};
  private readonly logger = new Logger(ShardRouterService.name);

  // Quorum parameters
  private readonly N = 3; // Total replicas
  private readonly R = 2; // Read quorum
  private readonly W = 2; // Write quorum

  constructor(
    @InjectQueue('handoff') private handoffQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    this.hashRing = new HashRing(20);

    // Define shards from environment
    const shards: ShardInfo[] = [
      { name: 'shard-a', connectionUrl: process.env.SHARD_A_URL },
      { name: 'shard-b', connectionUrl: process.env.SHARD_B_URL },
      { name: 'shard-c', connectionUrl: process.env.SHARD_C_URL },
      { name: 'shard-d', connectionUrl: process.env.SHARD_D_URL },
      { name: 'shard-e', connectionUrl: process.env.SHARD_E_URL }, // Added shard-e
    ];

    for (const shard of shards) {
      if (!shard.connectionUrl) {
        this.logger.error(
          `Connection URL for ${shard.name} is not defined in environment variables.`,
        );
        continue;
      }

      this.hashRing.addShard(shard);
      const prisma = new PrismaClient({
        datasources: { db: { url: shard.connectionUrl } },
      });

      this.shardClients[shard.name] = prisma;

      try {
        await prisma.$connect();
        this.logger.log(
          `Successfully connected to ${shard.name} at ${shard.connectionUrl}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to connect to ${shard.name} at ${shard.connectionUrl}: ${(error as Error).message}`,
        );
      }
    }
  }

  async onModuleDestroy() {
    for (const [shardName, client] of Object.entries(this.shardClients)) {
      try {
        await client.$disconnect();
        this.logger.log(
          `PrismaClient for shard ${shardName} disconnected successfully.`,
        );
      } catch (error) {
        this.logger.error(
          `Error disconnecting PrismaClient for shard ${shardName}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Retrieves the shard name corresponding to a given PrismaClient instance.
   * @param prisma The PrismaClient instance.
   * @returns The name of the shard or 'unknown-shard' if not found.
   */
  public getShardNameFromPrisma(prisma: PrismaClient): string {
    for (const [name, client] of Object.entries(this.shardClients)) {
      if (client === prisma) {
        return name;
      }
    }
    return 'unknown-shard';
  }

  /**
   * Get the shards responsible for a given key based on replication factor.
   * @param key The key to hash (userId).
   * @returns Array of ShardInfo responsible for the key.
   */
  public getShardsForKey(key: string): ShardInfo[] {
    return this.hashRing.getShardsForKey(key, this.N);
  }

  /**
   * Get the PrismaClients responsible for a given key.
   * @param key The key to hash (userId).
   * @returns Array of PrismaClient instances.
   */
  public getPrismaClientsForKey(key: string): PrismaClient[] {
    const shards = this.getShardsForKey(key);
    return shards.map((shard) => this.getPrismaClient(shard.name));
  }

  /**
   * Get the primary shard responsible for a given key.
   * @param key The key to hash (userId).
   * @returns ShardInfo
   */
  public getShardForKey(key: string): ShardInfo {
    return this.hashRing.getPrimaryShard(key);
  }

  /**
   * Get the shard responsible for a User based on userId.
   * @param userId The User's ID.
   * @returns ShardInfo
   */
  public getShardForUser(userId: string): ShardInfo {
    return this.getShardForKey(userId); 
  }

  /**
   * Get the PrismaClient for a specific shard.
   * @param shardName The name of the shard.
   * @returns PrismaClient
   */
  public getPrismaClient(shardName: string): PrismaClient {
    const prisma = this.shardClients[shardName];
    if (!prisma) {
      this.logger.error(`PrismaClient for shard ${shardName} not found.`);
      throw new Error(`PrismaClient for shard ${shardName} not found.`);
    }
    return prisma;
  }

  /**
   * Get all PrismaClients across shards.
   * @returns Array of PrismaClient instances.
   */
  public async getAllShardClients(): Promise<PrismaClient[]> {
    return Object.values(this.shardClients);
  }

  /**
   * Remove a shard from the ring (for failure handling).
   * @param shardName The name of the shard to remove.
   */
  public removeShard(shardName: string): void {
    this.hashRing.removeShard(shardName);
    const prisma = this.shardClients[shardName];
    if (prisma) {
      prisma
        .$disconnect()
        .then(() => {
          delete this.shardClients[shardName];
          this.logger.warn(
            `Shard ${shardName} removed from the ring and PrismaClient disconnected.`,
          );
        })
        .catch((error) => {
          this.logger.error(
            `Error disconnecting PrismaClient for shard ${shardName}: ${(error as Error).message}`,
          );
        });
    } else {
      this.logger.warn(`Shard ${shardName} not found among connected shards.`);
    }
  }

  /**
   * Add a new shard to the ring.
   * @param shard The ShardInfo object for the new shard.
   */
  public async addShard(shard: ShardInfo): Promise<void> {
    if (!shard.connectionUrl) {
      this.logger.error(`Connection URL for ${shard.name} is not defined.`);
      throw new Error(`Connection URL for ${shard.name} is not defined.`);
    }

    this.hashRing.addShard(shard);
    const prisma = new PrismaClient({
      datasources: { db: { url: shard.connectionUrl } },
    });

    this.shardClients[shard.name] = prisma;

    try {
      await prisma.$connect();
      this.logger.log(
        `Successfully connected to new shard ${shard.name} at ${shard.connectionUrl}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to connect to new shard ${shard.name} at ${shard.connectionUrl}: ${(error as Error).message}`,
      );
      delete this.shardClients[shard.name];
      throw error;
    }
  }

  /**
   * Write data to multiple shards with write quorum.
   * @param key The key to hash (userId).
   * @param writeFn The write function to execute on each shard.
   */
  public async writeWithQuorum(
    key: string,
    writeFn: (prisma: PrismaClient) => Promise<void>,
  ): Promise<ShardInfo[]> { // Return successful shards
    const shards = this.getShardsForKey(key);
    let successfulWrites = 0;
    const successfulShards: ShardInfo[] = [];
  
    this.logger.log(
      `Attempting to write to shards: ${shards.map(s => s.name).join(', ')} for key '${key}'`,
    );
  
    for (const shard of shards) {
      const prisma = this.getPrismaClient(shard.name);
      try {
        await writeFn(prisma);
        successfulWrites += 1;
        successfulShards.push(shard);
        this.logger.log(
          `Write succeeded on shard '${shard.name}' for key '${key}'.`,
        );
        // Continue writing to other shards for complete replication
      } catch (error) {
        this.logger.error(
          `Write failed on shard '${shard.name}' for key '${key}': ${(error as Error).message}`,
        );
      }
    }
  
    if (successfulWrites < this.W) {
      this.logger.error(
        `Write quorum not achieved for key '${key}'. Required: ${this.W}, Succeeded: ${successfulWrites}.`,
      );
      throw new Error('Write quorum not achieved.');
    } else {
      this.logger.log(
        `Write quorum achieved (${this.W}/${this.W}). Data replicated to ${successfulWrites} out of ${shards.length} shards.`,
      );
      return successfulShards; // Return the shards where write was successful
    }
  }

  /**
   * Read data from multiple shards with read quorum.
   * @param key The key to hash (userId).
   * @param readFn The read function to execute on each shard.
   * @returns The data if quorum is achieved, else null.
   */
  public async readWithQuorum<T>(
    key: string,
    readFn: (prisma: PrismaClient) => Promise<T | null>,
  ): Promise<T | null> {
    const shards = this.getShardsForKey(key);
    const results: T[] = [];
    let successfulReads = 0;

    this.logger.log(
      `Attempting to read from shards: ${shards.map(s => s.name).join(', ')} for key '${key}'`,
    );

    for (const shard of shards) {
      const prisma = this.getPrismaClient(shard.name);
      try {
        const data = await readFn(prisma);
        if (data) {
          results.push(data);
          successfulReads += 1;
          this.logger.log(
            `Read succeeded on shard '${shard.name}' for key '${key}'.`,
          );
          if (successfulReads >= this.R) {
            this.logger.log(
              `Read quorum achieved (${this.R}/${this.R}).`,
            );
            break;
          }
        }
      } catch (error) {
        this.logger.error(
          `Read failed on shard '${shard.name}' for key '${key}': ${(error as Error).message}`,
        );
        // Continue trying with the next shard
      }
    }

    if (successfulReads >= this.R) {
      // Optionally, implement conflict resolution if needed
      // For simplicity, return the first successful read
      return results[0];
    } else {
      this.logger.error(
        `Read quorum not achieved for key '${key}'. Required: ${this.R}, Succeeded: ${successfulReads}.`,
      );
      return null;
    }
  }
}
