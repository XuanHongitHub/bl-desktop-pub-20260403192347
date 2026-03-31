import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import { BrowserReleaseAuthGuard } from "./browser-release-auth.guard.js";
import { BrowserReleaseService, type BrowserSlug } from "./browser-release.service.js";

@Controller("v1/browser")
export class BrowserReleaseController {
  constructor(private readonly browserReleaseService: BrowserReleaseService) {}

  @Get(":slug.json")
  async getBrowserMetadata(@Param("slug") slug: string) {
    const normalizedSlug = slug.trim().toLowerCase();
    if (normalizedSlug !== "bugox" && normalizedSlug !== "bugium") {
      throw new NotFoundException("browser_not_found");
    }
    const payload = await this.browserReleaseService.getBrowserMetadata(
      normalizedSlug as BrowserSlug,
    );
    if (!payload) {
      throw new NotFoundException("browser_manifest_not_found");
    }
    return payload;
  }

  @Post("release")
  @UseGuards(BrowserReleaseAuthGuard)
  async publishBrowserRelease(@Body() body: unknown) {
    try {
      return await this.browserReleaseService.upsertBrowserRelease(body);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "invalid_payload",
      );
    }
  }
}
