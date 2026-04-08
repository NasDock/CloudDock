# CloudDock Mini Program (微信小程序)

微信小程序版 CloudDock，功能 1:1 映射自 `packages/mobile`。

## 技术栈

- 微信小程序原生开发（app.json + pages 目录结构）
- TypeScript
- globalData 状态管理
- @cloud-dock/shared 类型和工具

## 目录结构

```
mini/
├── src/
│   ├── app.ts              # 应用入口
│   ├── app.json           # 小程序配置（tabBar、window）
│   ├── api/
│   │   ├── client.ts      # HTTP 请求封装（支持 token 刷新）
│   │   ├── auth.ts        # 认证 API
│   │   ├── tunnel.ts      # 隧道 API
│   │   ├── device.ts      # 设备 API
│   │   └── request-device.ts  # 访问控制 API
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── login/     # 登录页
│   │   │   └── register/  # 注册页
│   │   ├── tabs/
│   │   │   ├── index/     # 首页/仪表盘
│   │   │   ├── tunnels/   # 隧道列表
│   │   │   ├── devices/   # 防火墙/设备管理
│   │   │   └── profile/   # 个人中心
│   │   ├── tunnel/
│   │   │   ├── create/    # 创建隧道
│   │   │   └── detail/    # 隧道详情
│   │   └── device/
│   │       └── scan/      # 二维码扫描绑定
│   ├── stores/
│   │   ├── auth.ts        # 认证状态管理
│   │   └── tunnel.ts      # 隧道状态管理
│   ├── utils/
│   │   └── formatters.ts  # 格式化工具
│   └── types/
│       └── global.d.ts    # 类型声明
├── assets/icons/           # tabBar 图标（需手动添加）
├── project.config.json    # 微信开发者工具配置
├── tsconfig.json
├── sitemap.json
└── package.json
```

## 快速开始

1. 安装依赖

```bash
cd packages/mini
npm install
```

2. 添加 tabBar 图标

在 `src/assets/icons/` 目录下添加以下图标文件（PNG 格式，81x81 px）：
- `home.png` / `home-active.png`
- `tunnel.png` / `tunnel-active.png`
- `device.png` / `device-active.png`
- `profile.png` / `profile-active.png`

3. 使用微信开发者工具导入项目

- 打开微信开发者工具
- 选择「导入项目」
- 项目目录选择 `packages/mini`
- AppID 使用「测试号」或填入真实 AppID

4. 配置服务器地址

首次打开时在登录页面填入服务器地址，默认为 `https://cloud.audiodock.cn`

## 功能列表

- [x] 登录/注册（自动登录状态检测）
- [x] 首页仪表盘（统计、近期隧道、待审批设备）
- [x] 隧道列表（搜索、过滤、启用/禁用、删除）
- [x] 创建隧道（HTTP/TCP/UDP）
- [x] 隧道详情（访问信息、流量统计、访问日志）
- [x] 防火墙/设备管理（访问控制、客户端列表）
- [x] 二维码扫描绑定设备
- [x] 个人中心（账号信息、登出）

## API 对接

所有 API 调用通过 `src/api/client.ts` 中的 `request()` 函数处理：
- 自动携带 Authorization header
- 自动处理 401 token 刷新
- 统一的错误处理

shared 包类型直接引用：
```ts
import type { Tunnel, UserPublic, Protocol } from '@cloud-dock/shared';
```

## 状态管理

使用小程序内置的 `globalData` + 模块化 store：

```ts
// 获取全局状态
const app = getApp<IAppOption>();
app.globalData.isAuthenticated;

// 使用 store
import { authStore } from '../stores/auth';
import { tunnelStore } from '../stores/tunnel';
```
