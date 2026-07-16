# 修复 WebRTC P2P 模式下手机浏览器无法访问 NAS web 服务

## 背景
用户场景：手机与 NAS 经 WebRTC P2P 组网后，在手机浏览器访问 `http://100.64.0.1:3000`（NAS 虚拟 IP 上的 web 子项目 / edge 容器 Web UI）访问不了。nas-client 日志显示 WebRTC data channel 已 open，但发起访问时无新日志。

## 根因
当前"代理模式"链路（手机 TUN 捕获 TCP 流 → WebRTC DataChannel → NAS ProxyServer 连本地 TCP）：

1. 手机浏览器访问 `http://100.64.0.1:3000`
2. 手机端 `CloudDockVpnService.kt` TUN 捕获 SYN → 发 `vpnProxyConnect {host:'100.64.0.1', port:3000}`
3. JS `ProxyClient` → `sendProxyConnect` → WebRTC 发 `proxy_connect`
4. NAS `webrtc-manager.ts` 收到 → `client.ts:307` `onProxyConnectReceived` → `proxyServer.handleConnect(peerId, streamId, '100.64.0.1', 3000)`
5. NAS `proxy-server.ts:42` `socket.connect(3000, '100.64.0.1')` → **失败**

**问题**：NAS 上根本没有 `100.64.0.1` 这个地址。VPN Gateway（TUN，`tunAddress:'100.64.0.1'`）在 `client.ts:222` 被默认注释禁用，且 proxy 模式下本就不需要 TUN。NAS 虚拟 IP `100.64.0.1` 语义上指向的是 **NAS 本机的服务**，应重定向到 `127.0.0.1`，而代码把它当成普通远程地址去 `socket.connect`，必然 EHOSTUNREACH/ENETUNREACH。

> 说明："NAS 无日志"有两种可能：(a) 手机端没点"开启组网"导致 VPN/TUN 未启动，native 没发 `proxy_connect`（WebRTC 连接 ≠ VPN 启动，VPN 需在 `profile.tsx` 手动开启）；(b) 发了但 NAS 连 `100.64.0.1` 失败的 warn 未被注意。无论哪种，NAS 端虚拟 IP 重定向都是必须修的 bug。

## 修复方案

### 改动 1：NAS 端 proxy_connect 虚拟 IP 重定向 + 诊断日志（核心）
文件：`packages/nas-client/src/client.ts`，`startWebRTCSignal` 内 `onProxyConnectReceived` 回调（约 307 行）

把目标为 NAS 虚拟 IP `100.64.0.1` 的连接重定向到 `127.0.0.1`，并加 info 日志确认 `proxy_connect` 到达：

```typescript
this.webrtcManager.onProxyConnectReceived = (peerId, msg) => {
  // NAS 虚拟 IP (100.64.0.1) 指向 NAS 本机服务（web UI 等），重定向到 localhost。
  // proxy 模式下 NAS 不创建 TUN 接口，直接连本机回环即可。
  const NAS_VIRTUAL_IP = '100.64.0.1';
  const targetHost = msg.host === NAS_VIRTUAL_IP ? '127.0.0.1' : msg.host;
  logger.info('Proxy connect received', {
    peerId, streamId: msg.streamId, host: msg.host, targetHost, port: msg.port,
  });
  this.proxyServer?.handleConnect(peerId, msg.streamId, targetHost, msg.port);
};
```

- 访问 `100.64.0.1:3000` → NAS 连 `127.0.0.1:3000`（edge 容器 Web UI，host 网络模式可达）✓
- 访问局域网其他设备 `192.168.1.x:port` → NAS 直连真实 IP，不受影响 ✓
- info 日志可在 LOG_LEVEL=info 下看到，用于确认手机端是否真的发出了 `proxy_connect`

### 改动 2（可选）：ProxyServer 连接成功日志提级
文件：`packages/nas-client/src/modules/proxy-server.ts:43`
`handleConnect` 的 `socket.connect` 成功回调当前是 `logger.debug`，info 下不显示。可提级为 `logger.info`，便于确认端到端打通。失败已是 `logger.warn`（保留）。

## 不做的事
- **不重新启用 NAS 端 TUN/VPN Gateway**：proxy 模式通过 TCP 流代理转发，NAS 端无需 TUN 接口；启用反而引入 TCP-over-TCP 问题（client.ts:220 注释已说明）。`100.64.0.1` 仅作为"NAS 本机"的语义标识，在 proxy 层重定向即可。
- **不改手机端**：`CloudDockVpnService.kt` native 捕获逻辑正确，`vpn-store.ts`/`ProxyClient` 转发逻辑正确。手机端唯一前提是用户点了"开启组网"启动 VPN。

## 验证步骤
1. 重建/重启 nas-client（`clouddock-edge` 容器）
2. 手机登录后在「我的」页点「开启组网」，确认状态变 connected
3. 手机浏览器访问 `http://100.64.0.1:3000`
4. 预期：看到 NAS Web UI
5. 查 nas-client 日志：
   - 应出现 `Proxy connect received {host:'100.64.0.1', targetHost:'127.0.0.1', port:3000}`
   - 应出现 `Proxy TCP connected {streamId,...}`（若做了改动 2）
   - **若没有 `Proxy connect received` 日志**：说明手机端 `proxy_connect` 未到达 → 检查手机「开启组网」是否真的 connected、Android VPN 权限是否授予，问题在手机端而非本修复
