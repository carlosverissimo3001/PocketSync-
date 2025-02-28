import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ListsService } from './lists.service';
import { SyncListsDto } from '@/dtos/sync-lists.dto';
import { CreateListDto } from '@/dtos/create-list.dto';

@Controller('lists')
export class ListsController {
  constructor(private listsService: ListsService) {}

  /**
   * Batch of lists sent from a FE.
   * @param body - A DTO containing a user ID and an array of lists.
   * @returns - Nothing.
   */

  @Post()
  async enqueueListChanges(@Body() body: SyncListsDto) {
    return this.listsService.enqueueListChanges(body);
  }

  @Post('create')
  async createList(@Body() body: CreateListDto) {
    return this.listsService.createList(body);
  }

  /**
   * A single list sent from a FE.
   * @param body - A DTO containing a user ID and a list.
   * @returns - Nothing.
   */
  @Post('update')
  async updateList(@Body() body: SyncListsDto) {
    // Note: The user id in the body might not be the owner
    return this.listsService.enqueueListChanges(body);
  }

  /**
   * Get all lists for a user.
   * @param userId - The ID of the user.
   * @returns - An array of lists.
   */
  @Get('user/:userId')
  async getLists(@Param('userId') userId: string) {
    return this.listsService.getLists(userId);
  }

  /**
   * Get a single list by ID.
   * @param id - The ID of the list.
   * @returns - A single list.
   */
  @Get(':id')
  async getList(@Param('id') id: string) {
    return this.listsService.getList(id);
  }
}
