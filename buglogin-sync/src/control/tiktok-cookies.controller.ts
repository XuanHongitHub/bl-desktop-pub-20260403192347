import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ControlAuthGuard } from "./control-auth.guard.js";
import { ControlService } from "./control.service.js";

type ActorHeaders = {
  "x-user-id"?: string;
  "x-user-email"?: string;
  "x-platform-role"?: string;
  "x-bugidea-bearer"?: string;
};

@Controller("api/tiktok-cookies")
@UseGuards(ControlAuthGuard)
export class TiktokCookiesController {
  constructor(private readonly controlService: ControlService) {}

  @Get()
  list(@Headers() headers: ActorHeaders) {
    return this.controlService.listTiktokCookies(
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
    );
  }

  @Post()
  create(
    @Headers() headers: ActorHeaders,
    @Body() body: { label?: string; cookie?: string; notes?: string | null },
  ) {
    return this.controlService.createTiktokCookie(
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
      {
        label: body.label ?? "",
        cookie: body.cookie ?? "",
        notes: body.notes ?? null,
      },
    );
  }

  @Post("bulk")
  bulkCreate(
    @Headers() headers: ActorHeaders,
    @Body() body: { cookies?: string[]; prefix?: string | null },
  ) {
    return this.controlService.bulkCreateTiktokCookies(
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
      {
        cookies: Array.isArray(body.cookies) ? body.cookies : [],
        prefix: body.prefix ?? null,
      },
    );
  }

  @Put(":id")
  update(
    @Headers() headers: ActorHeaders,
    @Param("id") id: string,
    @Body()
    body: {
      label?: string;
      cookie?: string;
      status?: string;
      notes?: string | null;
    },
  ) {
    return this.controlService.updateTiktokCookie(
      id,
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
      body,
    );
  }

  @Delete(":id")
  delete(@Headers() headers: ActorHeaders, @Param("id") id: string) {
    return this.controlService.deleteTiktokCookie(
      id,
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
    );
  }

  @Post(":id/test")
  test(@Headers() headers: ActorHeaders, @Param("id") id: string) {
    return this.controlService.testTiktokCookie(
      id,
      this.actorFromHeaders(headers),
      headers["x-bugidea-bearer"] ?? "",
    );
  }

  private actorFromHeaders(headers: ActorHeaders) {
    return this.controlService.resolveRequestActor({
      userId: headers["x-user-id"],
      email: headers["x-user-email"],
      hintedRole: headers["x-platform-role"] ?? null,
    });
  }
}
