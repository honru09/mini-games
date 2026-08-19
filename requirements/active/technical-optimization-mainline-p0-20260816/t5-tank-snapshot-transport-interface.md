# T5 Tank Snapshot Transport Interface

状态：`LOCAL_IMPLEMENTED / DEFAULT_OFF / NOT_RELEASED`

## Module 与 Seam

`TankSnapshotWireCodec` 是 Tank Authority 完整 `tank-authority-v1` 快照与可选传输封套之间唯一的纯 Module。它只接受和输出 canonical snapshot；Rule、Authority、Reward、Replay、Social、持久化、Renderer 和 WebSocket 均不在其 Interface 内。

`createTankSnapshotStream()` 是服务端按接收者保存发送基线的 Adapter。它不发送数据、不决定成员资格、不改变 `TankAuthority`；`server/index.js` 仍拥有 Room、Session、延迟观战、发送和完整 v1 fallback。

客户端 `online.decodeTankSnapshot()` 只在已协商 `tank-snapshot-delta-v2` 时解码，并把成功结果重新交给既有 `currentGame.onAuthoritySnapshot()`。Tank 游戏、DOM HUD 与 Ghost3D 继续只接收完整 `tank-authority-v1` snapshot。

## 固定 Interface

```js
const codec = TankSnapshotWireCodec.create({
  keyframeEveryTicks: 20,
  maxRecipients: 64,
  maxFramesPerRecipient: 4,
});

codec.encode(snapshot, { recipientKey, forceKeyframe });
codec.decode(envelope);
codec.forget(recipientKey);
codec.reset({ matchId });
codec.dispose();

const stream = createTankSnapshotStream({ enabled:true });
stream.encodeFor(sessionId, snapshot, { forceKeyframe:false });
stream.forget(sessionId);
stream.reset(matchId);
stream.dispose();
```

`encode()` 的成功值仅为 `keyframe` 或 `delta`。`decode()` 成功时才给出完整 canonical snapshot；重复、旧帧、缺基线、跨对局、冲突帧、未知字段、非有限数和非法长度均 fail-closed。缺基线或冲突不会猜测局面，只等待周期性 keyframe。

## v2 Wire

```js
{
  protocol: 'tank-snapshot-delta-v2',
  matchId,
  frameId,        // 传输层独立单调 ID；不能复用 serverTick
  baseFrameId,    // keyframe 为 null
  serverTick,
  kind: 'keyframe' | 'delta',
  payload
}
```

- keyframe 为完整、严格校验的 `tank-authority-v1` snapshot。
- delta 为无损 allowlist patch：标量、完整玩家记录、Projectile upsert/remove/order、稀疏墙体 cell、ack 与 order。
- 不做浮点量化或 lossy compact encoding；后续只有在真实测量和误差预算成立时才可另开批次。
- 仅当 delta 的序列化尺寸小于 keyframe 且不超过 64 KiB 时才发送 delta，否则完整 keyframe。
- 每个接收者最多 4 个发送基线；每个客户端最多 4 个接收基线；一个 stream 最多 64 个接收者。离开、断线、换局、停止或 dispose 清空基线。

## 协商、回滚与恢复

- 服务端开关：`ENABLE_TANK_SNAPSHOT_DELTA_V2=1`。默认 `0`。
- 只有服务端开关已开、当前 Session 声明 capability、stream 编码成功三者同时满足才发送 v2；其他所有情况发送原始完整 `tank_snapshot`。
- `tank-authority-v1`、`tank_input`、`tank_result`、Authority tick、Reward、Replay 和房间结算均未改变。
- 混合房间按 Session 发送：新客户端可收 v2，旧客户端同步继续收 v1。
- 初始、重连和观战 bootstrap 继续在现有 `rejoined/spectate_joined/spectating` payload 中提供完整 v1 state；新的 Session 在首次 live v2 传输也得到 keyframe。
- v2 decoder 失效后丢弃 envelope；不向 Renderer 交付局部状态。因为 1 秒（20 个 server tick）会有周期 keyframe，首批不增加 C→S keyframe-request wire。

## 已覆盖的本地证据

- `qa/tank-snapshot-wire-codec.js`：完整/增量无损、per-recipient base、尺寸 fallback、missing base、重复/冲突/乱序、跨对局、未知/非有限字段、容量、reset/dispose。
- `qa/tank-snapshot-stream.js`：default-off、独立接收者、forced keyframe、Authority 不可变、forget/reset/dispose。
- `qa/tank-snapshot-client.js`：协商 alias、v1 fallback、v2 keyframe/delta、缺 capability/错 match/缺基线 fail-closed、旧 spectating bootstrap 应用 Tank state。
- `qa/tank-snapshot-delta-online.js`：真实本地 WebSocket 的新旧混合客户、spectator bootstrap/live keyframe、重连 bootstrap/live keyframe。

这只是确定性本地证据。第二浏览器、真机和真实网络整形仍属于 `GATE-DEVICE-BROWSER-NETWORK`；其开发状态为 `NON_BLOCKING_FOR_DEVELOPMENT`，缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。本文件不声称这些证据已完成，也不解除发布或生产数据 Gate。
