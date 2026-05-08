# CloudDock VPN (TUN) 异地组网实施方案

## 一、目标

实现系统级 VPN 异地组网，使手机上的任意 App（如 Emby 客户端）无需配置代理即可直接访问 NAS 所在局域网的服务。WebRTC P2P 为主路径，现有 WebSocket Tunnel 中转为兜底方案。

## 二、现有架构梳理

| 组件 | 技术栈 | 关键文件 |
|------|--------|----------|
| Server | Fastify + ws + Prisma | `packages/server/src/gateway/{ws-tunnel,http-proxy,signal-server}.ts` |
| NAS Client | Node.js + wrtc | `packages/nas-client/src/{client.ts,webrtc/webrtc-manager.ts}` |
| Mobile | Expo SDK 52 + RN 0.76 + react-native-webrtc | `packages/mobile/src/webrtc/{webrtc-manager.ts,signal-client.ts,index.ts}` |
| Shared | TypeScript types | `packages/shared/src/types/{ws-message,webrtc-signal,webrtc-data}.ts` |

现有通信三层：
1. HTTP REST（控制面）
2. WebSocket Tunnel `/ws/device`（服务器中转，HTTP 请求/响应级）
3. WebRTC P2P `/ws/signal`（目前仅用于大文件传输，Mobile 端已实现但未接入 UI）

## 三、VPN 架构设计

### 3.1 网络拓扑

```
虚拟子网: 100.64.0.0/24 (CGNAT 段，Tailscale 同款)
  - NAS Gateway: 100.64.0.1/32
  - Mobile:      100.64.0.2/32

[手机任意App] --(OS路由)--> [TUN接口 100.64.0.2]
                                    |
                                    v (IP包)
                           [CloudDock Mobile App]
                                    |
                                    v (WebRTC DataChannel)
                           [CloudDock NAS Client]
                                    |
                                    v (IP包)
                           [TUN接口 100.64.0.1]
                                    |
                                    v (NAT)
                           [NAS本地局域网 192.168.x.x]
                                    |
                                    v
                           [Emby服务 :8096]
```

### 3.2 数据流

1. Emby 客户端访问 `http://192.168.1.100:8096`
2. Mobile OS 路由到 VPN TUN 接口
3. Mobile App 从 TUN fd 读取 IP 包
4. IP 包通过 WebRTC DataChannel 发送到 NAS
5. NAS Client 收到 IP 包，写入本地 TUN fd
6. NAS OS 做 NAT，转发到局域网 Emby 服务
7. 响应沿原路返回

### 3.3 兜底机制

WebRTC P2P 失败时：
- Mobile VPN TUN 保持开启
- IP 包封装为二进制消息，通过现有 WebSocket Tunnel 发送到 Server
- Server 新增 `tunnel_binary` 透传模式，直接转发给 NAS Client
- NAS Client 解封装写入 TUN
- P2P 恢复后自动切回 DataChannel

## 四、实施阶段

### Phase 1: Mobile 原生 VPN 模块（iOS + Android + RN Bridge）

**目标**: 让 Mobile App 能在系统层面创建 VPN 接口，JS 层可控。

#### iOS
- 新增 `PacketTunnelProvider` App Extension Target
- 使用 `NEPacketTunnelProvider` 创建 TUN 接口
- 配置虚拟 IP、路由（`100.64.0.0/24`）、DNS
- 通过 `Darwin` 通知或共享 Container 与主 App 通信
- 修改 Xcode 工程：`ios/NATTunnel.xcodeproj`
- 需在 Apple Developer Portal 申请 `com.apple.developer.networking.networkextension` entitlement

#### Android
- 新增 `CloudDockVpnService extends VpnService`
- `Builder().addAddress().addRoute().addDnsServer().establish()`
- 通过 `ParcelFileDescriptor` 读写 IP 包
- 绑定到前台 Service 保持存活
- 新增权限：`android.permission.BIND_VPN_SERVICE`

#### React Native Bridge
- 创建 `CloudDockVPNPackage` / `CloudDockVPNModule`
- JS API:
  - `VPN.start({ virtualIp, routes, dns }) => Promise<{status}>`
  - `VPN.stop() => Promise<void>`
  - `VPN.getStatus() => Promise<'connected'|'disconnected'|'connecting'>`
- Native → JS Events:
  - `vpnStatusChanged`
  - `vpnPacketReceived` (或直接用文件描述符，避免 bridge 瓶颈)

**关键文件新建/修改**:
```
packages/mobile/ios/VPNExtension/PacketTunnelProvider.swift
packages/mobile/ios/NATTunnel/CloudDockVPNBridge.m
packages/mobile/ios/NATTunnel/CloudDockVPNBridge.swift
packages/mobile/android/app/src/main/java/com/clouddock/app/vpn/CloudDockVpnService.kt
packages/mobile/android/app/src/main/java/com/clouddock/app/vpn/CloudDockVPNModule.kt
packages/mobile/android/app/src/main/java/com/clouddock/app/vpn/CloudDockVPNPackage.kt
packages/mobile/src/native/vpn.ts          (JS bridge wrapper)
```

**app.json 修改**:
- iOS: 添加 `com.apple.developer.networking.networkextension` capability
- Android: 添加 `BIND_VPN_SERVICE` permission

### Phase 2: NAS Client TUN 支持

**目标**: NAS Client 能读写 TUN 接口，作为虚拟网络网关。

- 引入 `tuntap2` (或 `node-tuntap`) npm 包创建 TUN 接口
- 配置 TUN: IP `100.64.0.1/24`, MTU 1280
- 启用系统 IP forwarding (sysctl/netsh)
- 配置 NAT: iptables/nftables (Linux) 或 pf (macOS) 或 Windows NAT
- 在 `nas-client/src/modules/vpn-gateway.ts` 实现:
  - `startTUN()` / `stopTUN()`
  - `readPacket(): Promise<Buffer>`
  - `writePacket(buf: Buffer)`

**关键文件新建**:
```
packages/nas-client/src/modules/vpn-gateway.ts
packages/nas-client/src/utils/network-setup.ts   (iptables/routing helper)
```

### Phase 3: IP over WebRTC DataChannel

**目标**: 扩展现有 WebRTC 数据通道，使其能承载原始 IP 包。

#### 协议扩展（`shared` 包）

```typescript
// packages/shared/src/types/vpn-data.ts
export interface VPNIPPacket {
  type: 'ip_packet';
  data: string; // base64-encoded raw IP packet
}

export interface VPNControlMessage {
  type: 'vpn_control';
  action: 'ip_assigned' | 'route_update' | 'heartbeat' | 'mtu_negotiate';
  payload: unknown;
}

export type VPNDataMessage = VPNIPPacket | VPNControlMessage;
```

#### Mobile 端修改
- `packages/mobile/src/webrtc/webrtc-manager.ts`:
  - 新增 `sendIPPacket(buf: ArrayBuffer): boolean`
  - `onmessage` 中解析 `ip_packet` 类型，写入 TUN
  - 移除现有仅文件传输的逻辑（或保留兼容）
- `packages/mobile/src/webrtc/index.ts`:
  - 新增 `sendVPNPacket()` 导出
  - 接入 VPN 模块的事件循环

#### NAS 端修改
- `packages/nas-client/src/webrtc/webrtc-manager.ts`:
  - 同理扩展 DataChannel 协议
  - 收到 `ip_packet` 写入 TUN
  - 从 TUN 读取的 IP 包通过 DataChannel 发送

### Phase 4: VPN 状态管理与 UI

**目标**: Mobile App 可启动/停止 VPN，显示状态。

- 新建 Zustand store: `packages/mobile/src/stores/vpn-store.ts`
  - `status: 'idle' | 'connecting' | 'connected' | 'failed'`
  - `virtualIp: string`
  - `nasVirtualIp: string`
  - `stats: { bytesIn, bytesOut, packetsIn, packetsOut }`
- 在 `(tabs)/profile.tsx` 或新建 `(tabs)/vpn.tsx` 添加：
  - VPN 开关（大按钮）
  - 状态显示
  - 虚拟 IP 展示
  - 流量统计
- 在 `_layout.tsx` 中初始化 VPN 管理器（类似现有 auth/tunnel hooks）

### Phase 5: WebSocket Tunnel 兜底（二进制透传）

**目标**: WebRTC P2P 不可用时，IP 包仍能通过现有 WebSocket Tunnel 到达 NAS。

#### Server 新增
- `packages/server/src/gateway/ws-binary-tunnel.ts`:
  - 新消息类型 `tunnel_binary`
  - 直接透传 `Buffer`（不解析为 HTTP）
  - 连接池按 `tunnelId` + `mode: 'vpn'` 路由

#### NAS Client 修改
- `packages/nas-client/src/client.ts`:
  - `handleMessage` 新增 `tunnel_binary` 处理
  - 收到后直接写入 TUN
- 新增 `sendBinaryViaTunnel(data: Buffer)` 方法

#### Mobile 修改
- VPN 模块检测 WebRTC `ready` 状态
- `ready === true`: IP 包走 DataChannel
- `ready === false`: IP 包封装为 `tunnel_binary` 走 WebSocket Tunnel
- 定时检测 P2P 恢复，自动切换

### Phase 6: 路由与网络优化

**目标**: 确保只有目标流量走 VPN，避免全流量劫持。

- **分屏路由 (Split Tunneling)**:
  - 默认只路由 `100.64.0.0/24` 和 NAS 所在局域网段（如 `192.168.1.0/24`）
  - 其他流量不走 VPN，避免影响正常上网
- **DNS 处理**:
  - 可选：在 Mobile 配置 `includeAllNetworks = false` (iOS) 或分应用 VPN (Android)
  - 或配置 DNS 仅解析特定域名时走 VPN
- **MTU 调整**:
  - WebRTC DataChannel + DTLS 开销约 60-100 bytes
  - TUN MTU 建议 1280（兼容 IPv6 和开销）
- **保活机制**:
  - VPN 层发送 ICMP echo / 自定义 heartbeat
  - WebRTC DataChannel 已有 `onconnectionstatechange`

## 五、关键文件变更清单

### 新建文件

```
packages/shared/src/types/vpn-data.ts
packages/shared/src/constants/vpn.ts

packages/mobile/ios/VPNExtension/
  PacketTunnelProvider.swift
  Info.plist
  PacketTunnelProvider.entitlements

packages/mobile/ios/NATTunnel/CloudDockVPNBridge.m
packages/mobile/ios/NATTunnel/CloudDockVPNBridge.swift

packages/mobile/android/app/src/main/java/com/clouddock/app/vpn/
  CloudDockVpnService.kt
  CloudDockVPNModule.kt
  CloudDockVPNPackage.kt

packages/mobile/src/native/vpn.ts
packages/mobile/src/stores/vpn-store.ts
packages/mobile/src/modules/vpn-packet-router.ts
packages/mobile/src/app/(tabs)/vpn.tsx

packages/nas-client/src/modules/vpn-gateway.ts
packages/nas-client/src/utils/network-setup.ts

packages/server/src/gateway/ws-binary-tunnel.ts
```

### 修改文件

```
packages/mobile/app.json                          (权限 + capabilities)
packages/mobile/ios/NATTunnel.xcodeproj/project.pbxproj  (Extension target)
packages/mobile/android/app/src/main/AndroidManifest.xml (VPN service)
packages/mobile/android/app/build.gradle          (如有额外依赖)
packages/mobile/src/app/_layout.tsx               (VPN provider 初始化)
packages/mobile/src/webrtc/webrtc-manager.ts      (IP packet send/receive)
packages/mobile/src/webrtc/index.ts               (新增 VPN packet API)

packages/nas-client/src/client.ts                 (tunnel_binary 处理)
packages/nas-client/src/webrtc/webrtc-manager.ts  (IP packet send/receive)

packages/server/src/gateway/ws-tunnel.ts          (binary mode 注册)
packages/server/src/index.ts                      (binary tunnel manager)

packages/shared/src/index.ts                      (导出 vpn-data types)
```

## 六、风险评估与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| iOS NetworkExtension 需要 Apple 审核和特殊 entitlement | 高 | 提前申请 entitlement，使用个人开发者账号测试阶段可用 basic VPN |
| React Native JS bridge 传输 IP 包性能瓶颈 | 中 | TUN fd 尽量在 native 层直接对接 WebRTC native 层，减少 bridge 拷贝 |
| NAS 上创建 TUN 需要 root/CAP_NET_ADMIN | 中 | 文档说明运行方式，Docker 运行需 `--privileged` 或 `--cap-add=NET_ADMIN` |
| Expo managed workflow 不支持 NetworkExtension | 高 | 项目已有 `ios/`/`android/` 原生目录（prebuild 状态），可直接修改原生工程 |
| WebRTC 在部分网络环境（对称 NAT/企业防火墙）无法 P2P | 中 | 必须实现 WebSocket Tunnel 兜底，且兜底路径要足够稳定 |
| IP 包在 JS 层处理导致视频卡顿 | 中 | 初期可能只能支持低码率，后续优化可用 JSI/TurboModules 或 C++ 模块 |
| Android 后台 Service 被系统杀死 | 中 | VpnService 作为前台 Service，绑定通知，系统优先级较高 |

## 七、工作量估算

| 阶段 | 工作量 | 说明 |
|------|--------|------|
| Phase 1: Mobile 原生 VPN | 3-4 天 | iOS NetworkExtension + Android VpnService + RN Bridge，最复杂 |
| Phase 2: NAS TUN 网关 | 1-2 天 | Node.js TUN 封装 + 系统路由配置 |
| Phase 3: IP over WebRTC | 2-3 天 | 协议扩展 + Mobile/NAS 双端数据通道改造 |
| Phase 4: VPN UI & 状态管理 | 1-2 天 | Store + Screen + 集成到现有导航 |
| Phase 5: WebSocket 兜底 | 2-3 天 | Server 透传 + 双端 fallback 逻辑 + 自动恢复 |
| Phase 6: 路由优化 & 测试 | 2-3 天 | Split tunneling + MTU + DNS + 多网络环境测试 |
| **总计** | **11-17 天** | 约 2-3 周，两人并行可缩短到 1-1.5 周 |

## 八、验收标准

1. Mobile App 内开启 VPN 后，系统设置中可见 VPN 连接
2. NAS 与 Mobile 成功建立 WebRTC P2P，分配虚拟 IP
3. 手机上任意 App 可通过虚拟 IP 或 NAS 局域网 IP 访问 NAS 服务
4. `ping 100.64.0.1` 从 Mobile 到 NAS 延迟 < 50ms（局域网环境下测试）
5. Emby 客户端可直接播放 NAS 上的视频（通过 VPN）
6. 断开 P2P 后，流量自动切换到 WebSocket Tunnel，服务不中断
7. 现有 WebSocket Tunnel HTTP 代理功能完全不受影响
