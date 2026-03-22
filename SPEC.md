# 内网穿透工具 - 产品规格文档 (SPEC.md)

_版本: 1.0.0_
_最后更新: 2026-03-21_
_作者: 产品经理 (product-manager)_

---

## 1. 项目概述

### 1.1 项目背景

家庭 NAS（Network Attached Storage）设备通常部署在私有网络环境中，无法直接从外部互联网访问。本项目旨在构建一个**内网穿透（NAT Traversal）工具**，通过在线服务端中转，使外部用户能够通过统一地址安全访问家庭内部服务。

### 1.2 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                        外部用户                               │
│   (浏览器 / App ──→ 统一访问地址: https://tunnel.example.com)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       在线服务端                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │  Web 控制台   │  │   REST API   │  │   WebSocket Gateway  ││
│  └──────────────┘  └──────────────┘  └──────────────────────┘│
│         │                │                     │             │
│         └────────────────┴─────────────────────┘             │
│                         │                                     │
│              ┌─────────▼─────────┐                          │
│              │   WS 连接管理器     │                          │
│              │  (NAS 长连接池)     │                          │
│              └────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │ WS 长连接 (保持)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      NAS 服务端                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │  Web 管理界面 │  │  WS 客户端   │  │    端口转发器         ││
│  └──────────────┘  └──────────────┘  └──────────────────────┘│
│                                           │                   │
│                                   ┌───────▼───────┐           │
│                                   │  家庭内部服务   │           │
│                                   │ (HTTP/SSH/... )│           │
│                                   └───────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 关键术语

| 术语 | 说明 |
|------|------|
| **在线服务端** | 部署在公网的云服务器，提供统一的访问入口和连接管理 |
| **NAS 服务端** | 部署在用户家庭网络的客户端，负责保持 WebSocket 长连接并转发本地服务 |
| **隧道（ Tunnel）** | 一个从在线服务端到 NAS 服务端的逻辑连接，对外暴露一个可访问的子路径 |
| **统一地址** | 用户访问家庭服务的入口 URL，格式如 `https://tunnel.example.com/{userId}/{appName}/` |
| **凭证（ Token）** | NAS 服务端连接在线服务端时使用的认证密钥 |

---

## 2. 功能列表

### 2.1 在线服务端功能

#### 2.1.1 用户认证模块
- **用户注册**：支持邮箱 + 密码注册，邮箱需验证
- **用户登录**：支持邮箱 + 密码登录，签发 JWT 访问令牌
- **会话管理**：支持多设备登录查看，强制登出功能
- **密码重置**：通过邮件发送重置链接

#### 2.1.2 隧道管理模块
- **隧道列表**：查看当前账号下所有隧道及状态
- **创建隧道**：配置隧道名称、本地服务地址（host:port）、协议类型（HTTP/TCP）
- **编辑隧道**：修改隧道配置（仅离线状态可编辑）
- **删除隧道**：删除隧道（需确认操作）
- **隧道状态**：实时显示隧道在线/离线状态

#### 2.1.3 WebSocket 网关
- **连接认证**：基于 JWT 验证 NAS 服务端身份
- **连接保活**：心跳检测（ping/pong），间隔 30 秒
- **多路复用**：支持单 NAS 同时建立多个隧道
- **流量转发**：将外部请求透明转发到对应 NAS

#### 2.1.4 访问控制
- **IP 白名单**（可选）：限制哪些 IP 可以访问隧道
- **访问日志**：记录每次访问的时间、来源 IP、目标服务
- **速率限制**：防止滥用（每 IP 每分钟请求上限）

### 2.2 NAS 服务端功能

#### 2.2.1 Web 管理界面
- **服务配置**：配置在线服务端地址、连接凭证
- **隧道配置**：添加/编辑/删除本地要暴露的服务
- **状态仪表盘**：显示连接状态、流量统计
- **日志查看**：查看运行日志（支持日志级别筛选）

#### 2.2.2 WebSocket 客户端
- **自动重连**：断线后自动重连，支持指数退避（最大间隔 5 分钟）
- **隧道保活**：维护所有活跃隧道的健康检测
- **本地服务发现**：自动发现本地网络中的可用服务（可选）

#### 2.2.3 端口转发
- **TCP 转发**：支持任意 TCP 协议（如 SSH、RDP、游戏服务器）
- **HTTP 转发**：支持 HTTP/HTTPS 服务，保留原始 Host 头
- **UDP 转发**（可选）：支持 DNS、视频流等 UDP 协议

### 2.3 Web 前端功能（用户控制台）

#### 2.3.1 账户管理
- 登录/注册界面
- 个人资料编辑
- 更改密码
- API Token 管理（用于 API 访问）

#### 2.3.2 隧道管理界面
- 隧道列表（卡片形式）
- 创建隧道向导
- 隧道详情/编辑
- 连接日志查看

#### 2.3.3 监控面板
- 实时连接状态
- 流量使用统计
- 在线设备列表

### 2.4 移动端功能（Expo + RN）

- 与 Web 前端功能一致的移动端 App
- 支持 iOS 和 Android
- 支持扫码快速绑定 NAS（通过 NAS 管理界面生成二维码）
- 推送通知：隧道离线/上线提醒

### 2.5 边缘功能（可选 v2）

- 自定义域名绑定（用户使用自己的域名）
- SSL 证书自动申请（Let's Encrypt）
- 流量配额管理

---

## 3. 用户流程

### 3.1 账号注册与登录

```
用户 ──→ 注册页面 ──→ 填写邮箱/密码 ──→ 验证邮箱 ──→ 注册成功 ──→ 登录
                                                                          │
                                            ┌────────────────────────────┘
                                            ▼
                                     登录成功 ──→ 控制台首页
```

### 3.2 NAS 服务端部署流程

```
运维人员 ──→ 下载 NAS 客户端 ──→ 在 NAS 上安装配置
                                      │
                    ┌─────────────────┴──────────────────┐
                    ▼                                      ▼
            首次启动向导                          手动配置（docker / 二进制）
                    │                                      │
                    ▼                                      │
        输入在线服务端地址 + 凭证                      输入服务端地址 + 凭证
                    │                                      │
                    └─────────────────┬────────────────────┘
                                      ▼
                            WebSocket 连接成功
                                      │
                                      ▼
                            NAS 管理界面（Web UI）
                                      │
                                      ▼
                        添加本地服务 → 配置隧道
```

### 3.3 隧道创建流程

```
用户在控制台（Web/App）:
1. 点击「添加隧道」
2. 填写配置：
   - 隧道名称（e.g. "我的Nas管理后台"）
   - 本地服务地址（e.g. "192.168.1.100:5000"）
   - 协议类型（HTTP / TCP）
   - 访问凭证（可选，自动生成）
3. 点击创建 → 系统生成访问路径
4. 获得统一访问地址：
   https://tunnel.example.com/{userId}/{appName}/
```

### 3.4 用户访问家庭服务流程

```
外部用户 ──→ 访问统一地址
                 https://tunnel.example.com/user123/nas-panel/
                      │
                      ▼
              在线服务端接收请求
                      │
                      ▼
              根据 userId + appName 查找对应 WS 连接
                      │
                      ▼
              通过 WebSocket 转发请求到 NAS 服务端
                      │
                      ▼
              NAS 服务端接收请求，转发到本地服务
                      │
                      ▼
              本地服务处理请求，返回响应
                      │
                      ▼
              响应沿原路返回给外部用户
```

### 3.5 NAS 首次扫码绑定流程（移动端）

```
用户（移动端）:
1. 打开 App，扫描 NAS 管理界面上的二维码
2. App 解析二维码获取：服务端地址 + 绑定 Token
3. App 将当前登录用户与 NAS 设备关联
4. NAS 端收到绑定请求，显示绑定确认弹窗
5. 用户确认 → 绑定成功
```

---

## 4. API 设计

### 4.1 认证相关

#### POST /api/auth/register
注册新用户。

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "MyName"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "email": "user@example.com",
    "username": "MyName"
  }
}
```

#### POST /api/auth/login
用户登录。

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

#### POST /api/auth/refresh
刷新访问令牌。

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

#### POST /api/auth/logout
登出。

**Request Header:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "success": true
}
```

---

### 4.2 用户管理

#### GET /api/users/me
获取当前用户信息。

**Request Header:** `Authorization: Bearer {accessToken}`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "email": "user@example.com",
    "username": "MyName",
    "createdAt": "2026-03-21T00:00:00Z",
    "plan": "free"
  }
}
```

#### PUT /api/users/me
更新用户信息。

**Request:**
```json
{
  "username": "NewName",
  "oldPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

---

### 4.3 隧道管理

#### GET /api/tunnels
获取当前用户所有隧道。

**Request Header:** `Authorization: Bearer {accessToken}`

**Query Parameters:**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码（默认 1） |
| limit | int | 每页数量（默认 20） |
| status | string | 筛选状态（online/offline/all） |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tunnels": [
      {
        "tunnelId": "tnl_xyz789",
        "name": "我的NAS管理后台",
        "protocol": "http",
        "localAddress": "192.168.1.100:5000",
        "status": "online",
        "accessToken": "tok_xxx...yyy",
        "publicPath": "/usr_abc123/nas-panel/",
        "createdAt": "2026-03-21T00:00:00Z",
        "lastHeartbeat": "2026-03-21T03:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

#### POST /api/tunnels
创建新隧道。

**Request Header:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "name": "我的NAS管理后台",
  "protocol": "http",
  "localAddress": "192.168.1.100:5000",
  "localHostname": "nas.example.com",
  "ipWhitelist": ["1.2.3.4"],
  "metadata": {
    "description": "群辉NAS管理界面"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "tunnelId": "tnl_new123",
    "name": "我的NAS管理后台",
    "protocol": "http",
    "localAddress": "192.168.1.100:5000",
    "status": "offline",
    "accessToken": "tok_new...zzz",
    "publicPath": "/usr_abc123/nas-panel/",
    "createdAt": "2026-03-21T03:10:00Z"
  }
}
```

#### GET /api/tunnels/:tunnelId
获取单个隧道详情。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tunnelId": "tnl_xyz789",
    "name": "我的NAS管理后台",
    "protocol": "http",
    "localAddress": "192.168.1.100:5000",
    "status": "online",
    "publicPath": "/usr_abc123/nas-panel/",
    "statistics": {
      "totalRequests": 12345,
      "bytesIn": 1024000,
      "bytesOut": 2048000
    },
    "createdAt": "2026-03-21T00:00:00Z",
    "lastHeartbeat": "2026-03-21T03:00:00Z"
  }
}
```

#### PUT /api/tunnels/:tunnelId
更新隧道配置（仅离线状态可更新）。

**Request:**
```json
{
  "name": "NAS管理后台（新）",
  "localAddress": "192.168.1.100:8080"
}
```

#### DELETE /api/tunnels/:tunnelId
删除隧道。

**Response (200):**
```json
{
  "success": true,
  "message": "隧道已删除"
}
```

#### POST /api/tunnels/:tunnelId/regenerate-token
重新生成隧道的访问令牌。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "tok_new...zzz"
  }
}
```

---

### 4.4 NAS 设备管理

#### GET /api/devices
获取当前用户的所有 NAS 设备。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "dev_aaa111",
        "name": "家里的NAS",
        "status": "online",
        "tunnels": ["tnl_xyz789", "tnl_abc456"],
        "lastSeen": "2026-03-21T03:00:00Z"
      }
    ]
  }
}
```

#### POST /api/devices/bind
移动端扫码绑定 NAS 设备。

**Request:**
```json
{
  "bindToken": "XXXX.YYYY.ZZZZ",
  "deviceName": "家里的NAS"
}
```

#### DELETE /api/devices/:deviceId
解绑 NAS 设备。

---

### 4.5 访问日志

#### GET /api/tunnels/:tunnelId/logs
获取隧道访问日志。

**Query Parameters:**
| 参数 | 类型 | 说明 |
|------|------|------|
| startTime | ISO8601 | 开始时间 |
| endTime | ISO8601 | 结束时间 |
| page | int | 页码 |
| limit | int | 每页数量 |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "logId": "log_001",
        "timestamp": "2026-03-21T03:05:00Z",
        "clientIp": "1.2.3.4",
        "method": "GET",
        "path": "/",
        "statusCode": 200,
        "responseTime": 125
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 100 }
  }
}
```

---

### 4.6 错误响应格式

所有 API 错误均使用以下格式：

```json
{
  "success": false,
  "error": {
    "code": "TUNNEL_NOT_FOUND",
    "message": "隧道不存在或无权访问",
    "details": {}
  }
}
```

**常见错误码：**

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数校验失败 |
| 401 | UNAUTHORIZED | 未认证或令牌过期 |
| 403 | FORBIDDEN | 无权访问该资源 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突（如邮箱已注册） |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 5. 数据结构

### 5.1 用户 (User)

```typescript
interface User {
  userId:       string;      // 格式: usr_{uid}，如 usr_abc123
  email:        string;      // 唯一邮箱地址
  username:     string;      // 显示名称
  passwordHash: string;      // 密码哈希（bcrypt）
  plan:         'free' | 'pro' | 'enterprise';
  createdAt:    Date;
  updatedAt:    Date;
}
```

### 5.2 隧道 (Tunnel)

```typescript
interface Tunnel {
  tunnelId:      string;    // 格式: tnl_{id}
  userId:        string;    // 所属用户
  deviceId:      string;    // 所属设备（NAS）
  name:          string;    // 隧道名称
  protocol:      'http' | 'tcp' | 'udp';
  localAddress:  string;    // 本地服务地址，格式: host:port
  localHostname: string;    // 本地 Host 头（HTTP 协议时使用）
  status:        'online' | 'offline';
  accessToken:   string;    // 访问令牌（NAS 连接时使用）
  publicPath:    string;    // 公开访问路径，如 /usr_abc123/nas-panel/
  ipWhitelist:   string[];  // IP 白名单
  metadata:      Record<string, any>; // 用户自定义元数据
  createdAt:     Date;
  updatedAt:     Date;
  lastHeartbeat: Date;      // 最后一次心跳时间
}
```

### 5.3 设备 (Device)

```typescript
interface Device {
  deviceId:   string;       // 格式: dev_{id}
  userId:     string;       // 所属用户
  name:       string;       // 设备名称
  secretHash: string;       // 连接密钥哈希
  status:     'online' | 'offline';
  bindToken:  string;       // 临时绑定令牌（用于移动端扫码）
  bindTokenExpiredAt: Date; // 绑定令牌过期时间
  lastSeen:   Date;
  createdAt:  Date;
  updatedAt:  Date;
}
```

### 5.4 访问日志 (AccessLog)

```typescript
interface AccessLog {
  logId:       string;    // 格式: log_{id}
  tunnelId:    string;    // 所属隧道
  timestamp:   Date;
  clientIp:    string;    // 客户端 IP
  method:      string;    // HTTP 方法
  path:        string;    // 请求路径
  statusCode:  number;    // 响应状态码
  responseTime: number;  // 响应时间（ms）
  bytesIn:     number;    // 请求字节数
  bytesOut:    number;    // 响应字节数
}
```

### 5.5 设备会话 (DeviceSession)

```typescript
interface DeviceSession {
  sessionId:  string;    // 格式: ses_{id}
  deviceId:   string;   // 所属设备
  tunnelId:   string;   // 所属隧道
  serverId:   string;   // 连接到的在线服务端节点 ID
  connectedAt: Date;
  disconnectedAt: Date | null;
}
```

### 5.6 刷新令牌 (RefreshToken)

```typescript
interface RefreshToken {
  tokenId:  string;
  userId:   string;
  deviceId: string;   // 允许使用的设备（可选，用于限制刷新令牌范围）
  expiresAt: Date;
  createdAt: Date;
}
```

---

## 6. WebSocket 通信协议

### 6.1 连接建立

NAS 服务端连接在线服务端 WebSocket 时使用以下 URL：

```
wss://tunnel.example.com/ws/device?token={accessToken}
```

**连接流程：**

```
1. NAS 端：连接到 wss://tunnel.example.com/ws/device?token={deviceToken}
2. 服务端：验证 token 有效性
   - 有效：发送 { type: "auth_success", data: { deviceId, tunnels: [...] } }
   - 无效：发送 { type: "auth_error", data: { reason: "invalid_token" } }，关闭连接
3. 双方进入常规通信状态
```

### 6.2 消息格式

所有 WebSocket 消息统一使用 JSON 格式：

```typescript
// 客户端（NAS） → 服务端（在线服务端）
interface WSClientMessage {
  type: string;
  id:   string;    // 消息唯一 ID，用于 ACK
  data: any;
}

// 服务端（在线服务端） → 客户端（NAS）
interface WSServerMessage {
  type: string;
  id:   string;    // 对应请求的 ID，无请求则可省略
  data: any;
}
```

### 6.3 消息类型一览

| 方向 | type | 说明 |
|------|------|------|
| S→C | `auth_success` | 认证成功 |
| S→C | `auth_error` | 认证失败 |
| S→C | `heartbeat` | 心跳请求 |
| C→S | `heartbeat_ack` | 心跳响应 |
| C→S | `tunnel_open` | 请求打开隧道 |
| S→C | `tunnel_open_ack` | 隧道打开确认 |
| S→C | `tunnel_close` | 通知隧道关闭 |
| C→S | `tunnel_data` | 隧道数据（上行） |
| S→C | `tunnel_data` | 隧道数据（下行） |
| C→S | `tunnel_data_ack` | 数据接收确认 |
| S→C | `tunnel_status` | 隧道状态变更 |
| C→S | `bind_request` | 移动端绑定请求 |
| S→C | `bind_confirm` | 绑定确认请求 |

### 6.4 心跳机制

```json
// 服务端 → 客户端：心跳请求（每 30 秒）
{
  "type": "heartbeat",
  "id": "hb_001",
  "data": { "ts": 1710974400000 }
}

// 客户端 → 服务端：心跳响应
{
  "type": "heartbeat_ack",
  "id": "hb_001",
  "data": { "ts": 1710974400500 }
}
```

**超时策略：**
- 发送心跳后 10 秒内未收到 ACK：标记连接为不稳定
- 连续 3 次心跳超时：触发自动重连

### 6.5 隧道打开流程

```json
// 1. 客户端请求打开隧道
{
  "type": "tunnel_open",
  "id": "req_001",
  "data": {
    "tunnelId": "tnl_xyz789",
    "localAddress": "192.168.1.100:5000",
    "protocol": "http"
  }
}

// 2. 服务端确认隧道已打开
{
  "type": "tunnel_open_ack",
  "id": "req_001",
  "data": {
    "tunnelId": "tnl_xyz789",
    "status": "open",
    "publicPath": "/usr_abc123/nas-panel/"
  }
}

// 3. 服务端通知隧道异常关闭
{
  "type": "tunnel_close",
  "id": "evt_001",
  "data": {
    "tunnelId": "tnl_xyz789",
    "reason": "local_service_unreachable"
  }
}
```

### 6.6 数据传输流程

```json
// 外部用户发起 HTTP 请求时，服务端将请求转发给 NAS：

// 服务端 → 客户端：转发 HTTP 请求
{
  "type": "tunnel_data",
  "id": "data_001",
  "data": {
    "tunnelId": "tnl_xyz789",
    "requestId": "req_ext_abc123",
    "method": "GET",
    "path": "/",
    "headers": {
      "Host": "nas.example.com",
      "User-Agent": "Mozilla/5.0...",
      "Accept": "text/html"
    },
    "body": "",  // base64 编码
    "timestamp": 1710974400000
  }
}

// 客户端 → 服务端：返回 HTTP 响应
{
  "type": "tunnel_data",
  "id": "data_002",     // 新的消息 ID
  "data": {
    "tunnelId": "tnl_xyz789",
    "requestId": "req_ext_abc123",
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/html",
      "Content-Length": "1234"
    },
    "body": "PCFET0NUWVBFIHN..."  // base64 编码
  }
}

// 客户端收到数据后应发送 ACK
{
  "type": "tunnel_data_ack",
  "id": "data_001",
  "data": { "received": true }
}
```

### 6.7 移动端扫码绑定流程

```json
// 1. NAS 端生成绑定令牌（通过管理界面的 REST API）
//    服务端返回 bindToken: "XXXX.YYYY.ZZZZ"

// 2. 客户端展示二维码（内容为 bindToken 或服务端地址 + bindToken）

// 3. 移动端扫码后，发送绑定请求
{
  "type": "bind_request",
  "id": "bind_001",
  "data": {
    "bindToken": "XXXX.YYYY.ZZZZ",
    "userToken": "eyJhbGciOiJIUzI1NiIs..."  // 移动端用户的 JWT
  }
}

// 4. 服务端转发绑定确认给 NAS 端
{
  "type": "bind_confirm",
  "id": "bind_001",
  "data": {
    "bindToken": "XXXX.YYYY.ZZZZ",
    "username": "移动用户",
    "deviceName": "我的手机"
  }
}

// 5. NAS 端展示确认弹窗，用户确认后，NAS 端回复
{
  "type": "bind_confirm_ack",
  "id": "bind_001",
  "data": {
    "accepted": true,
    "deviceName": "家里的NAS"
  }
}
```

### 6.8 连接状态码

| 状态码 | 说明 |
|--------|------|
| 1000 | 正常关闭 |
| 1001 | 服务端即将关闭（如升级维护） |
| 1006 | 异常关闭（网络问题） |
| 4000 | 认证失败 |
| 4001 | Token 过期 |
| 4002 | 设备已被禁用 |
| 4003 | 账户已被禁用 |

---

## 7. 安全考量

### 7.1 认证与授权
- 密码使用 bcrypt（cost factor ≥ 12）存储
- 访问令牌使用 JWT（HS256），有效期 24 小时
- 刷新令牌有效期 30 天，支持撤销
- 隧道访问令牌使用随机生成的 32 字节密钥

### 7.2 传输安全
- 所有通信强制使用 TLS 1.2+（HTTPS / WSS）
- HTTP Host 头验证，防止路由污染
- 请求体大小限制（默认 10MB）

### 7.3 隔离与限流
- 用户间隧道完全隔离（通过 userId 隔离）
- 每个隧道请求速率限制：100 req/s
- 每个用户最大隧道数：免费 3 个，Pro 20 个，企业无限

### 7.4 日志与审计
- 访问日志保留 30 天
- 操作日志（隧道创建/删除）永久保留
- 日志中敏感信息（密码、Token）自动脱敏

---

## 8. 非功能性需求

### 8.1 性能目标
- API 响应时间 P95 < 200ms
- WebSocket 消息延迟 P95 < 50ms
- 服务端支持 10,000 并发 WebSocket 连接

### 8.2 可用性目标
- 在线服务端可用性 ≥ 99.9%
- NAS 客户端断线自动重连成功率 ≥ 99%

### 8.3 兼容性
- Web 前端：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- 移动端：iOS 13+, Android 8+ (API 26+)
- NAS 客户端：Linux (x86_64, ARM64), macOS, Synology DSM, QNAP QTS, TrueNAS

---

## 9. 项目目录结构（参考）

```
nat穿透工具/
├── SPEC.md
├── README.md
├── packages/
│   ├── server/                 # 在线服务端（Node.js / Express / ws）
│   ├── nas-client/             # NAS 客户端（Node.js / CLI + Web UI）
│   ├── web/                    # Web 前端（React + Vite）
│   ├── mobile/                 # 移动端（Expo + React Native）
│   └── shared/                 # 共享类型和工具（TS）
├── docker/
│   ├── server.dockerfile
│   └── nas.dockerfile
└── docs/
    ├── api/
    ├── deploy/
    └── faq.md
```

---

_文档结束_
