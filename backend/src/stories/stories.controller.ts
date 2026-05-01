import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common'
import { StoriesService } from './stories.service'

@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  @Header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
  listStories() {
    return this.stories.listStories()
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
  async getStory(@Param('slug') slug: string) {
    const story = await this.stories.getStory(slug)
    if (!story) {
      throw new NotFoundException('Story not found')
    }
    return story
  }
}
