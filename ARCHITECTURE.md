# 技术架构文档 (ARCHITECTURE.md)

_版本: 1.0.0_
_最后更新: 2026-03-21_
_作者: 软件架构师 (software-architect)_

---

## 1. Monorepo 目录结构

```
nat穿透工具/
├── .gitignore
├── .prettierrc
├── .prettierignore
├── package.json                 # 根 workspace 配置
├── pnpm-workspace.yaml          # pnpm workspace 定义
├── turbo.json                   # Turborepo 构建编排配置
├── tsconfig.base.json           # 基础 TypeScript 配置
├── .eslintrc.base.js            # 基础 ESLint 配置
├── .npmrc                       # pnpm 配置
├── .env.example                 # 环境变量示例
│
├── packages/
│   ├── shared/                  # 共享类型和工具（核心依赖最少）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/           # 共享类型定义
│   │       │   ├── user.ts
│   │       │   ├── tunnel.ts
│   │       │   ├── device.ts
│   │       │   ├── ws-message.ts
│   │       │   └── api.ts
│   │       ├── utils/           # 共享工具函数
│   │       │   ├── id.ts         # ID 生成（usr_, tnl_, dev_ 前缀）
│   │       │   ├── token.ts      # Token 生成/验证
│   │       │   ├── password.ts  # bcrypt 工具
│   │       │   └── validation.ts  # Zod schemas
│   │       ├── constants/        # 共享常量
│   │       │   └── index.ts
│   │       └── index.ts
│   │
│   ├── server/                  # 在线服务端（Node.js）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts       # 开发时 HMR（用于 WebSocket）
│   │   ├── Dockerfile
│   │   ├── .swcrc               # swc 编译配置
│   │   └── src/
│   │       ├── index.ts         # 入口文件
│   │       ├── app.ts           # Fastify 实例
│   │       ├── config/
│   │       │   └── index.ts      # 环境变量配置（带校验）
│   │       ├── modules/
│   │       │   ├── auth/         # 认证模块
│   │       │   │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.route.ts
│   │       │   └── strategies/
│   │       │       └── jwt.strategy.ts
│   │       │   ├── user/        # 用户模块
│   │       │   │   ├── user.controller.ts
│   │       │   ├── user.service.ts
│   │       │   └── user.route.ts
│   │       │   ├── tunnel/      # 隧道模块
│   │       │   │   ├── tunnel.controller.ts
│   │       │   ├── tunnel.service.ts
│   │       │   └── tunnel.route.ts
│   │       │   ├── device/      # 设备模块
│   │       │   │   ├── device.controller.ts
│   │       │   ├── device.service.ts
│   │       │   └── device.route.ts
│   │       │   └── log/         # 日志模块
│   │       │       ├── log.controller.ts
│   │       │       ├── log.service.ts
│   │       │       └── log.route.ts
│   │       ├── gateway/
│   │       │   ├── ws-server.ts     # WebSocket Gateway
│   │       │   ├── ws-handler.ts    # 消息处理器
│   │       │   ├── ws-heartbeat.ts  # 心跳管理
│   │       │   ├── ws-tunnel.ts     # 隧道数据转发
│   │       │   └── connection-pool.ts  # 连接池管理
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts
│   │       │   ├── rate-limit.middleware.ts
│   │       │   ├── error.middleware.ts
│   │       │   └── logger.middleware.ts
│   │       ├── plugins/
│   │       │   ├── database.plugin.ts   # Prisma/数据库连接
│   │       │   ├── redis.plugin.ts      # Redis 连接
│   │       │   ├── swagger.plugin.ts    # API 文档
│   │       │   └── jwt.plugin.ts        # JWT 插件
│   │       ├── prisma/
│   │       │   └── schema.prisma        # Prisma 数据模型
│   │       └── utils/
│   │           ├── crypto.ts
│   │           └── response.ts          # 统一响应格式
│   │
│   ├── nas-client/              # NAS 客户端（Node.js CLI + Web UI）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts        # Web UI 开发配置
│   │   ├── Dockerfile
│   │   ├── .swcrc
│   │   ├── src/
│   │   │   ├── index.ts          # CLI 入口（命令行）
│   │   │   ├── client.ts         # WS 客户端主逻辑
│   │   │   ├── config/
│   │   │   │   └── index.ts      # NAS 本地配置（YAML）
│   │   │   ├── modules/
│   │   │   │   ├── tunnel-manager.ts   # 隧道管理
│   │   │   │   ├── port-forwarder.ts   # 端口转发
│   │   │   │   ├── http-proxy.ts       # HTTP 代理逻辑
│   │   │   │   ├── tcp-relay.ts        # TCP 中继
│   │   │   │   └── health-check.ts     # 健康检查
│   │   │   ├── ui/               # NAS Web 管理界面
│   │   │   │   ├── index.html
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Dashboard.tsx
│   │   │   │   │   ├── TunnelConfig.tsx
│   │   │   │   │   ├── Settings.tsx
│   │   │   │   │   └── Login.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── StatusBar.tsx
│   │   │   │   │   ├── TunnelCard.tsx
│   │   │   │   │   └── QRCodeModal.tsx
│   │   │   │   └── stores/
│   │   │   │       └── useStore.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       └── config-store.ts     # 本地配置文件读写
│   │   └── bin/
│   │       └── nas-client.js    # CLI 入口脚本
│   │
│   ├── web/                     # Web 前端（用户控制台）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── api/
│   │       │   ├── client.ts
│   │       │   ├── auth.ts
│   │       │   ├── tunnel.ts
│   │       │   ├── device.ts
│   │       │   └── log.ts
│   │       ├── pages/
│   │       │   ├── Login.tsx
│   │       │   ├── Register.tsx
│   │       │   ├── Dashboard.tsx
│   │       │   ├── TunnelList.tsx
│   │       │   ├── TunnelCreate.tsx
│   │       │   ├── TunnelDetail.tsx
│   │       │   ├── DeviceList.tsx
│   │       │   ├── Profile.tsx
│   │       │   └── NotFound.tsx
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   │   ├── Button.tsx
│   │       │   │   ├── Input.tsx
│   │       │   │   ├── Card.tsx
│   │       │   │   ├── Modal.tsx
│   │       │   │   ├── Table.tsx
│   │       │   │   ├── StatusBadge.tsx
│   │       │   │   └── LoadingSpinner.tsx
│   │       │   ├── layout/
│   │       │   │   ├── Header.tsx
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   └── PageContainer.tsx
│   │       │   └── tunnel/
│   │       │       ├── TunnelCard.tsx
│   │       │       ├── TunnelForm.tsx
│   │       │       └── TunnelStatus.tsx
│   │       ├── hooks/
│   │       │   ├── useAuth.ts
│   │       │   ├── useTunnel.ts
│   │       │   └── useWebSocket.ts
│   │       ├── stores/
│   │       │   ├── authStore.ts
│   │       │   └── tunnelStore.ts
│   │       ├── router/
│   │       │   └── index.tsx
│   │       ├── styles/
│   │       │   └── globals.css
│   │       └── utils/
│   │           ├── formatters.ts
│   │           └── validators.ts
│   │
│   └── mobile/                  # 移动端（Expo + React Native）
│       ├── package.json
│       ├── tsconfig.json
│       ├── app.json
│       ├── eas.json
│       ├── babel.config.js
│       └── src/
│           ├── App.tsx
│           ├── api/
│           │   ├── client.ts
│           │   ├── auth.ts
│           │   ├── tunnel.ts
│           │   └── device.ts
│           ├── screens/
│           │   ├── LoginScreen.tsx
│           │   ├── RegisterScreen.tsx
│           │   ├── DashboardScreen.tsx
│           │   ├── TunnelListScreen.tsx
│           │   ├── TunnelDetailScreen.tsx
│           │   ├── DeviceListScreen.tsx
│           │   ├── ProfileScreen.tsx
│           │   └── QRScanScreen.tsx
│           ├── components/
│           │   ├── ui/
│           │   │   ├── Button.tsx
│           │   │   ├── Input.tsx
│           │   │   ├── Card.tsx
│           │   │   ├── StatusBadge.tsx
│           │   │   └── LoadingOverlay.tsx
│           │   ├── tunnel/
│           │   │   ├── TunnelCard.tsx
│           │   │   └── TunnelForm.tsx
│           │   └── layout/
│           │       ├── Header.tsx
│           │       └── TabNavigator.tsx
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   ├── useTunnel.ts
│           │   └── usePushNotification.ts
│           ├── stores/
│           │   ├── authStore.ts
│           │   └── tunnelStore.ts
│           ├── navigation/
│           │   └── index.tsx
│           ├── utils/
│           │   └── formatters.ts
│           └── types/
│               └── navigation.ts
│
├── docker/
│   ├── server.dockerfile
│   ├── nas.dockerfile
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   └── prod.conf
│   └── prometheus/
│       └── prometheus.yml
│
├── docs/
│   ├── api/
│   │   └── README.md
│   ├── deploy/
│   │   ├── server.md
│   │   └── nas-client.md
│   ├── faq.md
│   └── websocket-protocol.md
│
└── scripts/
    ├── setup.sh
    ├── build.sh
    └── generate-types.ts
```

---

## 2. 技术选型

### 2.1 整体技术栈

| 层级 | 技术选型 | 选型理由 |
|------|----------|----------|
| **Monorepo 工具** | pnpm workspaces + Turborepo | pnpm 速度快、节省磁盘空间；Turborepo 提供增量构建缓存，CI 效率高 |
| **构建工具** | Vite 5 | 开发体验最佳（HMR 毫秒级），内置 TypeScript / CSS 支持，产物经过优化 |
| **语言** | TypeScript 5 (strict mode) | 类型安全是大型项目的必须；与 React/Node 生态深度集成 |
| **代码质量** | ESLint + Prettier + Husky | 开发规范统一，提交前自动检查 |

### 2.2 在线服务端 (packages/server)

| 模块 | 技术选型 | 选型理由 |
|------|----------|----------|
| **运行时** | Node.js 22 (LTS) | 稳定，V8 引擎性能优秀；WebSocket 场景 I/O 密集，Node 非常适合 |
| **Web 框架** | Fastify 4 | 比 Express 快 2-3 倍；内置 Schema 校验；插件生态丰富；与 TypeScript 集成良好 |
| **WebSocket** | ws (官方) | Node.js 生态最成熟、低依赖的 WebSocket 库；API 简洁 |
| **HTTP 客户端** | ofetch / undici | Node 18+ 内置 fetch；内部转发 HTTP 请求使用 undici（高性能） |
| **数据库** | PostgreSQL 16 + Prisma ORM | 关系型数据天然适合 PostgreSQL；Prisma 提供类型安全的 ORM |
| **缓存/会话** | Redis 7 | JWT 黑名单需要高速读写；WebSocket 连接状态缓存；限流计数 |
| **认证** | @fastify/jwt + refresh token | JWT 用于 API 访问（无状态）；Refresh Token 存 Redis 支持撤销 |
| **校验** | Zod | 与 TypeScript 深度集成，运行时校验 + 类型推导 |
| **日志** | pino | Fastify 内置日志，性能极高；结构化 JSON 日志便于 ELK 查询 |
| **API 文档** | @fastify/swagger + scalar | OpenAPI 3.0 自动生成 |
| **配置管理** | @faker-js/faker + Zod | 环境变量用 Zod schema 校验，启动时即失败 |

### 2.3 NAS 客户端 (packages/nas-client)

| 模块 | 技术选型 | 选型理由 |
|------|----------|----------|
| **运行时** | Node.js 22 | 与服务端一致，便于代码共享 |
| **WebSocket** | ws (同服务端) | 与服务端使用相同库，协议一致性有保障 |
| **HTTP 代理** | node:http + node:net | 自行实现 HTTP 隧道转发，保留原始 Host 头 |
| **CLI 框架** | picocolors + inquirer | 轻量 CLI 输出美化；交互式询问配置 |
| **本地配置** | js-yaml | NAS 配置文件使用 YAML 格式（用户友好） |
| **Web UI** | React 18 + Vite | 用于 NAS 本地管理界面（局域网访问） |
| **状态管理** | Zustand | 轻量，无 Provider 嵌套，TypeScript 支持好 |

### 2.4 Web 前端 (packages/web)

| 模块 | 技术选型 | 选型理由 |
|------|----------|----------|
| **框架** | React 18 + Vite | SPEC 要求；成熟生态，组件库丰富 |
| **路由** | React Router v6 | React 生态最主流的路由方案 |
| **状态管理** | Zustand + TanStack Query | Zustand：轻量全局状态；TanStack Query：API 缓存、自动重试 |
| **UI 组件** | Tailwind CSS + Headless UI | Tailwind：原子化 CSS，开发效率高；Headless UI：无样式组件 |
| **表单** | React Hook Form + Zod | 高性能表单；Zod 校验规则复用 shared 包 |
| **HTTP 客户端** | Axios + TanStack Query | Axios 拦截器统一处理 Token 刷新 |

### 2.5 移动端 (packages/mobile)

| 模块 | 技术选型 | 选型理由 |
|------|----------|----------|
| **框架** | Expo SDK 52 + React Native | SPEC 要求；Expo 简化 native 权限/构建流程 |
| **路由** | Expo Router | 基于文件系统的路由，约定式开发 |
| **状态管理** | Zustand + TanStack Query | 同 Web 前端，代码可高度复用 |
| **UI 组件** | React Native Paper | Material Design 3 组件库 |
| **扫码** | expo-camera | 原生扫码能力，无需复杂 native 配置 |
| **推送通知** | expo-notifications | 统一推送通知 API |

### 2.6 共享包 (packages/shared)

| 模块 | 技术选型 | 选型理由 |
|------|----------|----------|
| **类型** | TypeScript (仅类型) | 仅导出类型定义，无运行时依赖 |
| **校验** | Zod | Schema 可跨包复用（服务端校验 + 客户端表单校验） |
| **ID 生成** | nanoid | 唯一 ID 生成，URL 安全 |

---

## 3. 数据库选型

### 3.1 选型结论

**主数据库**: PostgreSQL 16
**缓存/会话**: Redis 7

### 3.2 选型理由

| 维度 | PostgreSQL | MySQL | SQLite | 选型结论 |
|------|------------|-------|--------|----------|
| **关系建模** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ (有限) | 用户-设备-隧道多对一关系需要外键约束 |
| **JSON 支持** | ⭐⭐⭐ (JSONB) | ⭐⭐ (JSON) | ⭐⭐ | Tunnel.metadata 和 AccessLog 字段适合 JSONB + GIN 索引 |
| **并发写入** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ (写入锁) | 10K WebSocket 连接场景需要良好并发写入 |
| **连接池** | PgBouncer 生态成熟 | ProxySQL 生态成熟 | 不需要 | 需要连接池避免耗尽连接数 |
| **扩展性** | ⭐⭐⭐ (分区表) | ⭐⭐ | ⭐ | 访问日志随时间增长，需要分区表保持查询性能 |

**Redis 用途**:
1. **JWT 黑名单**：Token 撤销时写入，TTL=Token 剩余有效期
2. **WebSocket 会话状态**：连接 deviceId ↔ serverId 映射缓存，水平扩展时多节点可共享
3. **限流计数**：Sliding Window 限流算法
4. **设备心跳状态**：临时心跳 timestamp，不持久化

### 3.3 ER 图

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Device      │       │     Tunnel      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ userId (PK)     │──────<│ deviceId (PK)   │──────<│ tunnelId (PK)   │
│ email (UNIQUE)  │  1:N  │ userId (FK)     │  1:N  │ deviceId (FK)   │
│ username       │       │ name            │       │ userId (FK)     │
│ passwordHash   │       │ secretHash      │       │ name            │
│ plan           │       │ status          │       │ protocol        │
│ createdAt      │       │ bindToken       │       │ localAddress    │
│ updatedAt      │       │ bindTokenExpAt  │       │ localHostname   │
└─────────────────┘       │ lastSeen        │       │ status          │
                           │ createdAt       │       │ accessToken     │
                           │ updatedAt       │       │ publicPath      │
                           └─────────────────┘       │ ipWhitelist     │
                              │                      │ metadata (JSONB)│
                              │ 1:N                  │ createdAt       │
                              │                      │ updatedAt       │
                              │                      │ lastHeartbeat   │
                              │                      └─────────────────┘
                              │                             │
                              │ 1:N                         │ 1:N
                              ▼                             ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ RefreshToken   │       │  DeviceSession  │       │   AccessLog    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ tokenId (PK)    │       │ sessionId (PK)  │       │ logId (PK)      │
│ userId (FK)     │       │ deviceId (FK)   │       │ tunnelId (FK)   │
│ deviceId       │       │ tunnelId (FK)  │       │ timestamp       │
│ expiresAt       │       │ serverId       │       │ clientIp        │
│ createdAt       │       │ connectedAt    │       │ method          │
└─────────────────┘       │ disconnectedAt │       │ path            │
                          └─────────────────┘       │ statusCode      │
                                                   │ responseTime   │
                                                   │ bytesIn        │
                                                   │ bytesOut       │
                                                   └─────────────────┘
```

### 3.4 Prisma Schema 设计

```prisma
// packages/server/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  free
  pro
  enterprise
}

enum Protocol {
  http
  tcp
  udp
}

enum Status {
  online
  offline
}

model User {
  userId       String   @id @default(dbgenerated("'usr_' || nanoid(12)")) @db.VarChar(20)
  email        String   @unique @db.VarChar(255)
  username     String   @db.VarChar(100)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  plan         Plan     @default(free)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  tunnels       Tunnel[]
  devices       Device[]
  refreshTokens RefreshToken[]

  @@map("users")
}

model Device {
  deviceId        String    @id @default(dbgenerated("'dev_' || nanoid(12)")) @db.VarChar(20)
  userId          String    @map("user_id") @db.VarChar(20)
  name            String    @db.VarChar(100)
  secretHash      String    @map("secret_hash") @db.VarChar(255)
  status          Status    @default(offline)
  bindToken       String?   @map("bind_token") @db.VarChar(64)
  bindTokenExpAt DateTime? @map("bind_token_expired_at")
  lastSeen        DateTime? @map("last_seen")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  user             User              @relation(fields: [userId], references: [userId], onDelete: Cascade)
  tunnels          Tunnel[]
  deviceSessions   DeviceSession[]

  @@index([userId])
  @@index([bindToken])
  @@map("devices")
}

model Tunnel {
  tunnelId      String    @id @default(dbgenerated("'tnl_' || nanoid(12)")) @db.VarChar(20)
  userId        String    @map("user_id") @db.VarChar(20)
  deviceId      String    @map("device_id") @db.VarChar(20)
  name          String    @db.VarChar(100)
  protocol      Protocol  @default(http)
  localAddress  String    @map("local_address") @db.VarChar(255)
  localHostname String?   @map("local_hostname") @db.VarChar(255)
  status        Status    @default(offline)
  accessToken   String    @map("access_token") @db.VarChar(64)
  publicPath    String    @map("public_path") @db.VarChar(255)
  ipWhitelist   String[]  @map("ip_whitelist")
  metadata      Json?     @db.Jsonb
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastHeartbeat DateTime? @map("last_heartbeat")

  user           User           @relation(fields: [userId], references: [userId], onDelete: Cascade)
  device         Device         @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)
  accessLogs     AccessLog[]
  deviceSessions DeviceSession[]

  @@index([userId])
  @@index([deviceId])
  @@index([publicPath])
  @@map("tunnels")
}

model AccessLog {
  logId        String   @id @default(dbgenerated("'log_' || nanoid(12)")) @db.VarChar(20)
  tunnelId    String   @map("tunnel_id") @db.VarChar(20)
  timestamp   DateTime @default(now())
  clientIp    String   @map("client_ip") @db.VarChar(45)
  method      String   @db.VarChar(10)
  path        String   @db.Text
  statusCode  Int      @map("status_code")
  responseTime Int     @map("response_time")
  bytesIn     BigInt   @map("bytes_in") @default(0)
  bytesOut    BigInt   @map("bytes_out") @default(0)

  tunnel      Tunnel   @relation(fields: [tunnelId], references: [tunnelId], onDelete: Cascade)

  @@index([tunnelId, timestamp])
  @@map("access_logs")
}

model DeviceSession {
  sessionId       String    @id @default(dbgenerated("'ses_' || nanoid(12)")) @db.VarChar(20)
  deviceId        String    @map("device_id") @db.VarChar(20)
  tunnelId        String?   @map("tunnel_id") @db.VarChar(20)
  serverId        String    @map("server_id") @db.VarChar(50)
  connectedAt     DateTime  @default(now()) @map("connected_at")
  disconnectedAt  DateTime? @map("disconnected_at")

  device  Device  @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)
  tunnel  Tunnel? @relation(fields: [tunnelId], references: [tunnelId], onDelete: SetNull)

  @@index([deviceId])
  @@index([tunnelId])
  @@map("device_sessions")
}

model RefreshToken {
  tokenId   String   @id @default(dbgenerated("'rft_' || nanoid(16)")) @db.VarChar(24)
  userId    String   @map("user_id") @db.VarChar(20)
  deviceId  String?  @map("device_id") @db.VarChar(20)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

### 3.5 索引策略

| 表名 | 索引字段 | 类型 | 用途 |
|------|----------|------|------|
| users | email | UNIQUE B-tree | 登录查询 |
| devices | userId | B-tree | 用户设备列表查询 |
| devices | bindToken | B-tree | 扫码绑定查询 |
| tunnels | userId | B-tree | 用户隧道列表查询 |
| tunnels | deviceId | B-tree | 设备隧道列表查询 |
| tunnels | publicPath | UNIQUE B-tree | HTTP 路由匹配 |
| access_logs | tunnelId, timestamp | B-tree (复合) | 日志分页查询 |
| refresh_tokens | userId | B-tree | Token 清理查询 |
| device_sessions | deviceId | B-tree | 设备连接状态 |

### 3.6 分区策略（v2 扩展）

```sql
-- AccessLog 表在 v2 可按月分区
CREATE TABLE access_logs (
  ...
) PARTITION BY RANGE (timestamp);

CREATE TABLE access_logs_2026_04 PARTITION OF access_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

---

## 4. 项目骨架（关键配置文件）

### 4.1 根目录 package.json

```json
{
  "name": "nat-tunnel-monorepo",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "typecheck": "turbo run typecheck",
    "db:migrate": "pnpm --filter server -- db:migrate",
    "db:generate": "pnpm --filter server -- db:generate",
    "db:studio": "pnpm --filter server -- db:studio",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "prettier": "^3.3.0",
    "turbo": "^2.3.0",
    "typescript": "^5.6.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 4.2 pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
```

### 4.3 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 4.4 tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", ".next"]
}
```

### 4.5 packages/shared/package.json

```json
{
  "name": "@cloud-dock/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsc --project tsconfig.json --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "nanoid": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### 4.6 packages/shared/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### 4.7 packages/server/package.json

```json
{
  "name": "@cloud-dock/server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/swagger": "^9.0.0",
    "@fastify/swagger-ui": "^4.0.0",
    "@prisma/client": "^5.22.0",
    "bcrypt": "^5.1.1",
    "fastify": "^4.28.0",
    "ioredis": "^5.4.0",
    "nanoid": "^5.0.0",
    "pino": "^9.4.0",
    "pino-pretty": "^11.2.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.12",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

### 4.8 packages/server/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "src/**/*.prisma"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

### 4.9 packages/server/vite.config.ts（开发 HMR 配置）

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### 4.10 packages/nas-client/package.json

```json
{
  "name": "@cloud-dock/nas-client",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "nas-client": "./bin/nas-client.js"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:ui": "vite --config vite.ui.config.ts",
    "build": "tsc --project tsconfig.json",
    "build:ui": "vite build --config vite.ui.config.ts",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@cloud-dock/shared": "workspace:*",
    "bcrypt": "^5.1.1",
    "inquirer": "^9.2.0",
    "js-yaml": "^4.1.0",
    "nanoid": "^5.0.0",
    "picocolors": "^1.0.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5