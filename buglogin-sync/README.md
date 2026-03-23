<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## BugLogin API Surface

This service now provides two API groups:

- `v1/objects/*` for sync object storage (S3 presign/list/delete/subscribe).
- `v1/control/*` for workspace control-plane APIs (workspace, membership, invite, entitlement, share, coupon, audit).

Additional operational endpoints:

- `GET /health`
- `GET /readyz`
- `GET /config-status`

### Control-plane highlights

- Workspace lifecycle:
  - `POST /v1/control/workspaces`
  - `GET /v1/control/workspaces`
  - `GET /v1/control/workspaces/:workspaceId/overview`
- Membership + invite:
  - `GET /v1/control/workspaces/:workspaceId/members`
  - `PATCH /v1/control/workspaces/:workspaceId/members/:targetUserId/role`
  - `POST /v1/control/workspaces/:workspaceId/members/:targetUserId/remove`
  - `POST /v1/control/workspaces/:workspaceId/members/invite`
  - `GET /v1/control/workspaces/:workspaceId/invites`
  - `POST /v1/control/workspaces/:workspaceId/invites/:inviteId/revoke`
  - `POST /v1/control/auth/invite/accept`
- Entitlement + sharing:
  - `GET /v1/control/workspaces/:workspaceId/entitlement`
  - `PATCH /v1/control/workspaces/:workspaceId/entitlement`
  - `POST /v1/control/workspaces/:workspaceId/share-grants`
  - `GET /v1/control/workspaces/:workspaceId/share-grants`
  - `POST /v1/control/workspaces/:workspaceId/share-grants/:shareGrantId/revoke`
- Coupon + admin:
  - `POST /v1/control/workspaces/:workspaceId/coupons/select-best`
  - `POST /v1/control/workspaces/:workspaceId/licenses/claim`
  - `POST /v1/control/admin/coupons`
  - `GET /v1/control/admin/coupons`
  - `POST /v1/control/admin/coupons/:couponId/revoke`
  - `GET /v1/control/admin/audit-logs`
  - `GET /v1/control/admin/overview`

### Control-plane auth

- If `CONTROL_API_TOKEN` is set, all `v1/control/*` endpoints require `Authorization: Bearer <token>`.
- `SYNC_TOKEN` is also accepted as bearer token for self-hosted desktop integration.
- If `CONTROL_API_TOKEN` is empty, control-plane endpoints run in open mode (development only).

> Control-plane now supports PostgreSQL persistence when `DATABASE_URL` is configured.
> On startup, `ControlService` boots schema, loads state from PostgreSQL, and persists every state change back to PostgreSQL.
> If `DATABASE_URL` is missing, it uses local SQLite persistence at `CONTROL_SQLITE_FILE` (default `./.data/control-state.sqlite`).
> `CONTROL_STATE_FILE` is only used for one-time legacy JSON import into SQLite.
> Bootstrap schema for production is documented at `docs/control-plane-postgres-schema.sql`.
> Production topology recommendations are documented in `docs/production-architecture.md`.
> `CONTROL_LICENSE_KEYS` can be configured for self-hosted license-claim flows.
> Format: `CODE:planId:profileLimit:billingCycle` (comma-separated).
> Example: `BUG-GROWTH-CLAIM:growth:300:monthly`

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
