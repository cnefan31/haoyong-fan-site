---
title: "NanoServer"
description: "零依赖的轻量 .NET Web 能力库：架在 HttpListener 上，可嵌入任意 .NET 应用，支持通用主机与 NativeAOT。"
technologies:
  - C#
  - .NET
  - NativeAOT
  - HttpListener
featured: true
weight: 3
link: "https://github.com/cnefan31/lite-server"
---

一个不依赖 IIS / Kestrel 的 .NET Web 能力库。直接基于 `System.Net.HttpListener`，可以当普通类库嵌进已有进程，也可以作为独立服务运行。仓库名是 `lite-server`。

## 解决的问题

在 .NET 里要一个 HTTP 服务，通常绕不开 ASP.NET Core + Kestrel 那套宿主，或者把站点交给 IIS。但如果需求只是「在已有进程里挂几组接口」——比如给桌面程序加一个本地 API、给后台任务加一个状态页——整套 Web 宿主就显得重了。

NanoServer 把这些收进一个零第三方依赖的库：路由、中间件、静态文件、JWT、SSE、WebSocket、文件上下传、后台任务都在里面，用的时候按需调用，不用的部分不引入开销。

```csharp
await using var server = new NanoWebServer();
server.MapGet("/hello", (req, res) => res.WriteAsync("Hello NanoServer"));
await server.StartAsync("127.0.0.1", 8090);
```

## 能力清单

| 类别 | 能力 |
|------|------|
| 路由 | 精准路由、`*` 单段通配、同路径多方法、任意方法路由、405 自动带 `Allow` 头 |
| 请求 | 查询参数强类型读取、表单解析、Body 同步/异步读取、Cookie、Token 提取 |
| 响应 | 文本/JSON 写出、状态码、204、错误响应、CORS 预检 |
| 文件 | 下载（Range / 206 / 416）、流式上传（进度回调）、流式发送、直播流 |
| 实时 | SSE、分块长连接、WebSocket（广播、定向、主动断开、心跳超时） |
| 安全 | HS256 JWT 签发/验签、Token 黑名单、简单 Token、Bearer Token、限流 |
| 中间件 | 自定义中间件、静态文件托管（ETag / 304 / 隐藏文件拒绝 / 目录防穿越） |
| 宿主 | 通用主机集成、DI 注册、每请求作用域、NativeAOT |
| 后台 | `BackgroundService` 承载的后台任务、进度查询、取消 |

## 几个关键设计

- **路由以 (路径, 方法) 为组合键**：同一条路径可以同时注册 GET 和 POST。常见做法是以路径为唯一键，第二个注册会被静默忽略。
- **鉴权认三种 token 通道**：`Authorization` 头、`?token=`、cookie。浏览器原生 `EventSource` 与 `WebSocket` 设不了自定义请求头，只认请求头会让 SSE / WS 永远 401。
- **JWT 黑名单收绝对时间戳**：`Add(token, expireAtUnixSeconds)`，语义明确，不用在调用侧换算 TTL。
- **完整 Range 支持**：206 / 416 / `Content-Range` 齐备，视频能拖进度条。
- **中间件顺序即执行顺序**，没有隐式插队。
- **全库无反射、无动态代码**，NativeAOT 下零 IL 警告。

静态文件与鉴权的默认顺序是**鉴权在前**（安全优先）：受保护站点不会被匿名拉走任何资源。副作用是 dotfile 探测会先拿到 401 而不是 403。如果站点本来就是公开静态站，把 `StaticFilesBeforeAuth` 打开即可翻转，两种顺序下受保护的接口都不会被匿名访问。

## 性能

仓库自带 `hey` 压测脚本，macOS arm64（10 核）、每轮 2000 请求、并发 50、3 轮取中位数的实测：

| 路径 | AOT | JIT | 说明 |
|------|-----|-----|------|
| `GET /api/health` | ~48,700 req/s | ~32,900 req/s | 纯路由基线 |
| `GET` 未命中路由 | ~43,800 req/s | ~27,400 req/s | 路由查找失败路径 |
| `GET /tiny.txt` | ~27,500 req/s | ~20,300 req/s | 静态文件，含 stat + 文件流 |
| `GET /api/me` | ~43,900 req/s | ~27,600 req/s | 含 HMAC-SHA256 验签 |
| `GET /api/di` | ~41,400 req/s | ~24,500 req/s | 含 DI 作用域创建与构造注入 |

P50 约 1.7–2.2 ms，P99 约 4.5–6.3 ms。无中间件的最小服务上，端到端中位数从 34.7k 提到 47.4k req/s（+37%）。

路由匹配做了一次零分配改造：`RouteMatch` 改 `readonly struct`，通配切段用 `stackalloc Span<Range>` 替代 `string.Split`，路由表改成不可变数组快照（注册期加锁替换引用，读取期零锁零复制）。精准命中从 0.112 µs / 72 B 降到 0.048 µs / 0 B。

仓库里还留了一个**被否决的优化**：给静态文件加「路径 → 文件元数据」缓存，能省掉约 1.96 µs/次的 `GetFullPath` + `new FileInfo`，但端到端压测无收益，且会让 ETag 变陈旧——文件内容改了，客户端仍收到 304 读旧内容。改动已整体回退。结论写进了文档：微基准的收益必须用端到端测量验证，缓存协商头绝不能缓存。

## 安全

框架层已处理的攻击面：

- 路径穿越：编码、双重编码、反斜杠、UTF-8 过编码等绕过方式
- dotfile 拒绝、CRLF 头注入
- JWT：拒绝 `alg=none` 与弱密钥，定长比较防时序侧信道
- Token 黑名单吊销、WebSocket 握手鉴权与消息大小上限

另带一个 SSRF 防护组件，用于「按用户给的 URL 发请求」的场景：

```csharp
using NanoServer.Security;

if (!SsrfGuard.IsSafe(userUrl, out SsrfGuard.Verdict verdict))
{
    return res.WriteErrorAsync(400, $"url rejected: {verdict}");
}
```

判定发生在**解析出 IP 之后**，拒绝回环、私有网段、链路本地（含云元数据 169.254.169.254）与保留段，并处理十进制、八进制、十六进制 IP 与 IPv4 映射 IPv6 等变形。仓库带 28 项安全回归断言。

## 与通用主机集成

生产环境推荐走 .NET 通用主机，与 DI、配置、日志、健康检查、优雅停机共用一套生命周期：

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddNanoServer(
    options =>
    {
        options.Host = "127.0.0.1";
        options.Port = 8090;
        options.JwtSecret = "your-secret";
        options.EnableWebSocket = true;
        options.StaticFileRoot = "wwwroot";
        options.AnonymousPaths.Add("/api/health");
    },
    server => server.MapGet("/api/health", (req, res) => res.WriteJsonAsync("""{"status":"ok"}""")));

await builder.Build().RunAsync();
```

`AddNanoServer` 会把根容器交给服务器，**每个请求创建独立作用域**，处理器里用 `req.RequireService<T>()` 直接解析服务。作用域由 `AsyncLocal<IServiceProvider>` 承载——`HttpListenerRequest` 在 .NET Core 上没有挂载数据的 `Items` 集合，处理器签名里也没有 `IServiceProvider`，`AsyncLocal` 能按逻辑调用链传播，同请求多层 `await` 共享、并发请求互不串扰。DI 是可选的，不设容器时库照常工作。

### 一个停止顺序的坑

通用主机的 **HostedService 停止顺序与注册顺序相反**。如果服务器宿主后注册，它会先停并关掉所有 WebSocket，推送服务就再也没机会发出「服务正在停止」的通知，客户端只能看到连接静默断开。所以 `AddNanoServer` 要放在最前注册，后台服务跟在它后面。

## 日志

库内关键路径都有结构化日志，基于 `Microsoft.Extensions.Logging` 抽象，不绑定具体 provider，全程无反射。事件 ID 分段：生命周期 1001–1003、请求 2001–2003、异常 3001–3002、鉴权 4001、静态文件 5001–5002、WebSocket 6001–6005、安全 7001–7003。

访问日志有几个安全默认值：默认不记录查询串（防 `?token=` 落进日志）、`/api/health` 默认排除、慢请求阈值与采样率都可调。实测同步写文件的访问日志会让吞吐降约 24%，采样 1/20 只降 2%。

## 快速验证

```bash
dotnet run --project samples/NanoServer.Sample                    # 通用主机模式
dotnet run --project samples/NanoServer.Sample -- --standalone    # 独立模式
dotnet publish samples/NanoServer.Sample -c Release -r osx-arm64 -o dist   # AOT 发布
./tools/security-test.sh                                          # 28 项安全回归
```

示例工程同时是自测页：DI 三种生命周期、日志注入、后台任务、WebSocket 服务端推送，都能在浏览器里点开验证。

## 来源与许可

能力边界参考了 PicoServer（作者 juziyu，https://picoserver.cn/）的公开文档、NuGet 包的 API 形态与实测行为。**代码是独立重写的**，仓库不含任何反编译产物或原始实现；PicoServer 的名称与实现归原作者，本项目与其无隶属或授权关系。

相对参考实现，这里重新设计的地方包括：同路径多方法、三种 token 通道、黑名单收绝对时间戳、完整 Range、中间件顺序显式化。采用 MIT 许可证。

仓库：[cnefan31/lite-server](https://github.com/cnefan31/lite-server)
