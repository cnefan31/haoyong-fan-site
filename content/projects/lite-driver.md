---
title: "LiteDriver"
description: "面向工业 SOCKET 设备的轻量 TCP 连接管理库：核心零 NuGet 依赖，支持 .NET 通用主机与 NativeAOT。"
technologies:
  - C#
  - .NET
  - NativeAOT
  - TCP
featured: true
weight: 5
link: "https://github.com/cnefan31/lite-driver"
---

工业现场的 TCP 长连接，难点通常不是「怎样 `ConnectAsync`」。设备断电、拔网线、进程僵死时 `Socket.Connected` 仍然是 true；重连之后，旧连接的半包和迟到的响应可能串进新连接；写命令超时了，也不知道设备到底执行没有。

LiteDriver 把这些收进一个库：连接生命周期、断线重连、运行时增删改设备、可插拔帧编解码、显式命令结果。核心包零 NuGet 依赖，只依赖 BCL。

已发布到 NuGet：`LiteDriver` 与 `LiteDriver.Hosting`（当前 0.1.3），支持 `net8.0` 与 `net10.0`。

## 它处理了哪些现场问题

| 现场问题 | 处理方式 |
|----------|----------|
| 设备断电、拔网线、进程僵死，`Socket.Connected` 仍为 true | 不用 `Connected` 判活；`Ready` 必须晚于 TCP 建连、应用握手、身份确认 |
| 断线后旧回调、旧半包、旧响应串进新连接 | 四层标识 `Generation / Epoch / ConnectionId / RequestId` 逐层隔离 |
| 设备重启后同一请求收到上一次的响应 | 每个物理连接独立 decoder、缓冲区与在途表，跨 epoch 一律丢弃 |
| 写命令超时后不知道设备到底执行了没 | 只返回 `SentOutcomeUnknown`，**绝不自动重放** |
| 设备帧没有 requestId | 强制单在途串行，不做不可靠的并发关联 |
| 配置热更新改错一个字段导致整片设备掉线 | 单写者事务：校验 → 冻结 → 预绑定 → 原子提交 → 停旧代，失败保持旧快照 |
| 裁剪后 AOT 发布成功但运行时缺类型 | 启动期冻结的显式工厂注册表，禁止反射与运行时代码生成 |

## 安装

```bash
dotnet add package LiteDriver
dotnet add package LiteDriver.Hosting   # 需要通用主机集成时
```

| 包 | 依赖 |
|----|------|
| `LiteDriver` | **无**（零 NuGet 依赖，仅 BCL） |
| `LiteDriver.Hosting` | `Microsoft.Extensions.Hosting.Abstractions`、`Microsoft.Extensions.DependencyInjection.Abstractions` |

Hosting 包只引用抽象包，不引入任何运行时实现——不含 `Microsoft.Extensions.Hosting` 本体、不含 DI 容器、不含日志实现，宿主自己决定用哪套。也刻意不引用 `Microsoft.Extensions.Options`：不用 `IOptions`，选项以 `LiteDriverHostOptions` POCO 显式传递。

## 最小示例

```csharp
using LiteDriver;
using LiteDriver.Configuration;
using LiteDriver.Protocol;

// 1. 注册设备种类：kindId 是配置里的稳定字符串键，不是 CLR 类型名
var driver = new LiteDriverBuilder()
    .RegisterKind("my-protocol", static ctx => new MyDeviceKind(ctx))
    .Build();

// 2. 启动并应用初始配置（不等待设备连上）
await driver.StartAsync(new DriverConfig
{
    Devices =
    [
        new DeviceDescriptor
        {
            DeviceId = "press-01",
            KindId = "my-protocol",
            Endpoints = [ new EndpointDescriptor { Host = "192.168.1.10", Port = 502 } ]
        }
    ]
});

// 3. 等链路可用后发一条命令
await driver.WaitUntilReadyAsync("press-01", TimeSpan.FromSeconds(10));
using var result = await driver.GetDevice("press-01")
    .ExchangeAsync(requestBytes, TimeSpan.FromSeconds(5));

switch (result.Disposition)
{
    case CommandDisposition.Executed:
        // 设备已接受
        break;
    case CommandDisposition.SentOutcomeUnknown:
        // 发出去了但结果未知：不要自动重放，先读回状态对账
        break;
}
```

`StartAsync` 不等设备连上，这是有意的：工业设备常常在系统启动时还没上电，若让启动阻塞到连上，整个宿主会被一个离线设备拖死。需要等链路时显式调 `WaitUntilReadyAsync`。

## 通用主机集成

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddLiteDriver(
    kinds => kinds.RegisterKind("my-protocol", static ctx => new MyDeviceKind(ctx)),
    host  => host.InitialConfig = MyConfig.Load());

using var host = builder.Build();
await host.RunAsync();
```

`LiteDriverHostedService` 只转发启动与停止，不复制状态机、不扫描程序集。启动期配置非法会让主机启动失败，而不是带病运行。

> **命名歧义**：命名空间 `LiteDriver` 与类 `LiteDriver` 同名。顶层语句里写 `GetRequiredService<LiteDriver>()` 会被解析成命名空间并报 `CS0118`。用 `using Driver = LiteDriver.LiteDriver;` 别名，或写 `global::LiteDriver.LiteDriver`。

## 扩展一个设备种类

只需实现两个接口。`CreateProtocol` 在每次物理连接时被调用，必须返回全新实例。

```csharp
public sealed class MyDeviceKind : IDeviceKind
{
    private readonly int _maxFrameSize;
    public MyDeviceKind(in ProtocolContext ctx) => _maxFrameSize = ctx.Limits.MaxFrameSize;

    public ISessionProtocol CreateProtocol(in ProtocolContext ctx) => new MyProtocol(_maxFrameSize);
}

public sealed class MyProtocol : ISessionProtocol
{
    public MyProtocol(int maxFrameSize) =>
        Decoder = new LengthPrefixFrameDecoder(2, bigEndian: true, lengthIncludesHeader: false, maxFrameSize);

    public IFrameDecoder Decoder { get; }                       // 每条连接新建
    public IFrameEncoder Encoder { get; } = new LengthPrefixFrameEncoder(2, true, false);
    public ISessionInitializer? Initializer => null;            // 需要握手时提供
    public IHeartbeatPolicy? Heartbeat => null;                 // 需要应用心跳时提供
    public IResponsePolicy Response { get; } = new NextFrameResponsePolicy();
}
```

内置分包器：`FixedLengthFrameDecoder`、`LengthPrefixFrameDecoder`、`TerminatorFrameDecoder`、`DelimitedFrameDecoder`、`PassthroughFrameDecoder`。

若设备帧「以固定字节开始、以固定字节结束」，直接用 `DelimitedKind`，标记用十六进制配：

```csharp
builder.RegisterKind("stx-etx", DelimitedKind.CreateFactory("02", "03"), DelimitedKind.ValidateSettings);
```

| start | end | 切帧规则 |
|-------|-----|----------|
| `02` | `03` | 起始到结束 |
| `02` | 空 | 本起始到下一起始之前 |
| 空 | `ffffffff` | 缓冲区开头到结束标记 |

交付的帧包含标记本身；起始标记之前的垃圾字节会被静默丢弃并重新同步。

## 命令结果语义

- `NotSent` —— 确认整帧未写出（未 Ready、队列满、入队前取消），**可以重试**。
- `SentOutcomeUnknown` —— 已交给内核但没有响应，或超时、断链、部分写出。**不可以自动重放**，先读回状态对账。
- `Rejected` —— 收到匹配的应用层否定应答，不重试。
- `Executed` —— 收到匹配的应用层接受应答，按业务需要读回确认。
- `Canceled` —— 调用方取消且确认未写出，可以重试。
- `BackpressureRejected` —— 写队列或在途表已满，退避后可以重试。

这一栏是库的核心态度：把「不知道」和「没发出」分开，不用重试把不确定性掩盖掉。

## 关键不变量

- 一个 socket 任意时刻只有一个写循环，完整帧写完才释放写锁
- 一个 socket 任意时刻只有一个读泵，decoder 不跨连接复用
- 所有回调携带 epoch，旧 epoch 一律丢弃
- 写队列、在途表、读缓冲、帧长、会话数全部有上限
- 主动 Stop 产生的关闭不触发重连
- 心跳开启但协议未提供心跳实现时，显式报 `heartbeat-unsupported-by-kind`，不静默当作已启用

## 配置与调优

默认值来自源码，属保守起点，现场需按设备特性校准。下表省略了 `DriverLimits.` / `RetryOptions.` / `HeartbeatOptions.` 前缀。

| 参数 | 默认 | 说明 |
|------|------|------|
| `MaxFrameSize` | 1 MiB | 单帧上限，超出即关闭当前链路 |
| `MaxWriteQueue` | 128 | 队列越深，断链时被判 Unknown 的命令越多 |
| `InitialMs` / `MaxMs` | 500 / 30000 | 指数退避 `min(Initial × 2^n, Max)` |
| `Jitter` | 0.2 | 多设备同时断线时避免同步重连风暴 |
| `IntervalMs` × `Misses` | 5000 × 3 | 约等于判死时间，须小于内核 keepalive 判死时间 |

`DriverLimits` 在 `Build()` 时校验，非法直接抛 `ArgumentException`。

TCP keepalive 只能证明对端内核可能还活着，不能证明 PLC 应用仍正常——所以心跳做在应用层，且要求协议自己给出探活帧与判据。

## 可视化测试台

仓库里带一个测试台：同屏运行一个**客户端驱动**（主动拨号）与一个**服务端驱动**（监听接入），两者互连做连通测试，可切换协议、改端口、看事件流。

![LiteDriver 测试台：双驱动、5 条连通断言与事件流水](/images/projects/lite-driver/01-testbench.png)

```bash
dotnet run --project samples/LiteDriver.TestBench -- --port 8099
# 打开 http://127.0.0.1:8099/
```

点一次按钮就会逐项验证：客户端 Ready、服务端出现入站会话、交换成功、服务端应答符合协议、以及「裸 socket 直连服务端」这条绕开客户端驱动的独立验证。内置四种协议——长度前缀、终止符（含握手与心跳）、固定长度、Modbus 风格（带事务 ID），新增自定义协议只需在 `ProtocolCatalog.cs` 加一项。

## 做什么，不做什么

**做**：TCP 明文长连接管理、断线重连、运行时增改删、可插拔帧编解码、显式命令结果、通用主机集成、NativeAOT。

**不做**：具体 PLC 协议（Modbus / S7 / MC / FINS / SECS）、TLS / 串口 / UDP / WebSocket / RPC、运行时装插件、磁盘持久化命令队列、自动重放写命令。

## 文档

- [架构设计与审阅稿](https://github.com/cnefan31/lite-driver/blob/main/docs/lite-driver-architecture-review.html)——单文件 HTML，断网可开
- [API 说明](https://github.com/cnefan31/lite-driver/blob/main/docs/API.md)
- [配置参数与调优](https://github.com/cnefan31/lite-driver/blob/main/docs/CONFIGURATION.md)
- [发布流程](https://github.com/cnefan31/lite-driver/blob/main/docs/PUBLISHING.md)

NuGet：[LiteDriver](https://www.nuget.org/packages/LiteDriver) · [LiteDriver.Hosting](https://www.nuget.org/packages/LiteDriver.Hosting)。采用 MIT 许可证。
