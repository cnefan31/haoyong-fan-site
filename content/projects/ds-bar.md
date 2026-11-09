---
title: "DS Bar"
description: "安卓应用：在手机上查看 DeepSeek 账户余额与 token 用量，余额常驻通知栏、进快捷磁贴。Flutter 界面，取数与后台任务在 Kotlin 原生层。"
technologies:
  - Flutter
  - Dart
  - Kotlin
  - Android
featured: true
weight: 4
link: "https://github.com/cnefan31/ds-bar"
---

一个安卓小工具，把 DeepSeek 的账户余额和用量放到手机上随时能看：主页看明细，下拉通知栏看余额，快捷设置磁贴也能挂一个。界面是 Flutter，取数、缓存、定时刷新都在 Kotlin 原生层。

## 解决的问题

DeepSeek 官方公开 API 只有余额和模型列表，没有按时间、按 key 的 token 用量接口。想看「今天花了多少、哪个 key 用得多、哪个模型吃 token」，只能开电脑登录开放平台翻页面。

DS Bar 把这些数据取到手机上，并解决一个更实际的问题：余额要能随时瞥一眼。所以除了应用内页面，还有常驻通知和快捷磁贴——不解锁、不开 App 就能看到今天花了多少、本月还剩多少。

## 功能

| 模块 | 内容 |
|------|------|
| 账户余额 | 登录后走平台账户摘要（充值 + 赠送）；也可用官方 `GET /user/balance`（需 API Key） |
| 今日用量 | 消费、token、请求次数，缓存命中/未命中/输出构成条 |
| 本月用量 | 逐日柱状图 + 合计 |
| 按 API Key | 每个 key 的本月消费、token、请求与今日消费；登录后自动发现账号下全部 Key |
| 按模型 | 每个模型的 token 占比、消费、缓存命中率 |
| Key 状态 | 每个已配置 key 的有效性校验（打码展示） |
| 通知栏 | 常驻通知：余额 + 今日消费 + 本月消费（无操作按钮，点卡进 App） |
| 快捷磁贴 | 快捷设置面板显示余额，点按刷新 |
| 后台刷新 | 平台 `JobScheduler` 定时（最少 15 分钟），仅联网时执行，重启后保留 |

没有凭据时可以打开「演示数据」预览全部界面，数字为虚构。

## 数据从哪来

| 数据 | 接口 | 鉴权 |
|------|------|------|
| 余额 | `api.deepseek.com/user/balance` | API Key（官方公开接口） |
| 本月用量 / 消费 | `platform.deepseek.com/api/v0/usage/amount`、`usage/cost` | 平台 userToken（网页私有接口） |
| 今日用量 | `platform.deepseek.com/api/v0/usage/export`（本地时区窗口） | 平台 userToken |
| 分 key 明细 | 同上（本月 CSV） | 平台 userToken |
| 余额（登录态） | `users/get_user_summary` | `x-dsh-auth-token` |
| Key 列表 | `users/get_api_keys` | `x-dsh-auth-token` |

余额是账户级数据——同一账号下所有 key 共享一个余额，不存在「每个 key 各自余额」。分 key 用量按平台侧 `api_key_name` 聚合，本地 key 名称与平台一致时对照才准确。

## 一键浏览器登录

手动去浏览器 F12 复制 `userToken` 太麻烦，所以做了浏览器授权：跳到系统浏览器完成登录，自动回到 App 并配好。

平台授权接口用授权码 + PKCE（强制 S256），且 `redirect_uri` **只接受 `http://127.0.0.1:PORT/oauth/callback`**——自定义 scheme 和外部域名都被拒。所以协议要求 App 自己起一个只绑环回地址的一次性 HTTP 服务接回调：端口随机、只处理一个请求、回完即关，回调必须带本次生成的一次性 `state`（定长比较），否则拒收，`state` 不写日志。

这条路走下来踩了几个坑，都固化成了测试：

| 坑 | 现象 | 处理 |
|------|------|------|
| 后台进程被冻结 | 浏览器跳到 `127.0.0.1` 连得上但没人应答，登录必然超时（华为 EMUI 实测） | 登录期间挂前台服务保活，结束即停 |
| JVM 单测里 `android.util.Base64` 是未实现桩 | PKCE 相关单测全报 `not mocked` | 自己实现 base64url，顺带避开 `java.util.Base64` 的 API 26 要求（工程 minSdk 24） |
| 鉴权头用错 | 登录显示「已连接」，但余额与用量全空、Key 列表不出现 | 平台返回 **HTTP 200 + `{"code":40003,"msg":"Authorization Failed (invalid token)"}`**。浏览器 grant 必须用 `x-dsh-auth-token` 头，手动粘贴的网页 userToken 才用 `Authorization: Bearer` |
| 探针只看状态码 | 「测试连接」全部显示 200，实际全失败 | 平台用 200 承载错误码，必须校验响应体里的 `code == 0` |

第三条是真实的排查难点：状态码 200 看着一切正常，问题是响应体里的错误码。

## 架构与设计取舍

| Flutter (Dart) | Android 原生 (Kotlin) |
|------|------|
| `main.dart` 入口与主题 | `MainActivity` MethodChannel 桥 |
| `src/app_state.dart` 全局状态 | `DsRepository` 取数 + 汇总快照 |
| `src/native_bridge.dart` 通道封装 | `DsHttp` 原生 HTTP |
| `src/models.dart` 防御式解析 | `UsageParser` JSON / CSV 解析 |
| `src/ui/home_page.dart` 概览 | `DsPrefs` 配置与缓存 |
| `src/ui/settings_page.dart` 设置 | `BalanceNotification` 常驻通知 |
| `src/ui/charts.dart` 图表 | `BalanceTileService` 快捷磁贴 |
| `src/format.dart` 展示格式化 | `RefreshJobService` 定时刷新 |

**取数与聚合全在原生层**，Dart 只做展示与配置写入，通过单一 MethodChannel 通信。原因很直接：定时任务、通知栏、磁贴都在原生侧运行，如果聚合放在 Dart，后台刷新时无法更新通知与磁贴。

数据流是一条线：

```
DsRefresh.perform()
  → DsRepository.refresh()       逐 key 查余额、拉平台用量、汇总
  → 写 SharedPreferences 缓存
  → BalanceNotification.show()   更新常驻通知
  → BalanceTile.requestUpdate()  更新磁贴
```

界面读同一份缓存快照，App 内、通知栏、磁贴三处显示永远一致。

## 安全

- 凭据只存应用私有 `SharedPreferences`，不上传任何第三方服务器。
- 所有请求由手机直连 `deepseek.com`，无中转。
- 凭据明文不进入 Dart 层缓存；界面只显示「已配置 / 未配置」与打码后的 key。
- 通知栏与磁贴只显示金额与 token 数，不显示 key。
- 浏览器登录的本地回调服务只绑 `127.0.0.1`。

## 包体积

从基线 49.8MB 削到每架构分包 6.6–7.3MB，降幅 85% 以上。逐项来源（以 arm64 分包为例）：

| 措施 | 效果 |
|------|------|
| split-per-abi 分包（每包只带自己架构的 `.so`） | 49.8 → 17.5MB |
| `.so` 改为可压缩 | 17.5 → 8.2MB |
| 移除 WorkManager，改用平台 `JobScheduler` | dex 1.48 → 1.02MB |
| ProGuard 去掉 `-keep class io.flutter.** { *; }`，改用 `-keepnames` | dex 1.02 → 0.73MB |
| 移除 `androidx.core`（用平台 Notification API） | 计入上项 |
| 移除未使用的字体依赖 | −0.26MB |
| `--split-debug-info` | 再降 0.2MB |

代价写在明处：可压缩 `.so` 会让安装时解压、占盘 23MB；`--split-debug-info` 之后崩溃堆栈要配 `flutter symbolize` 和 `build/symbols` 才能看。

本项目自己引入的运行时依赖为**零**。构建图里剩下的 `kotlin-stdlib` 与 `kotlinx-coroutines` 是 Flutter 嵌入层经 `androidx.lifecycle:lifecycle-common` 传递进来的，删不掉。Kotlin 侧不接受任何 `implementation(...)`，有单测守着这条线，同一测试也会拦住「把 fat keep 规则加回来」这种让 dex 胖一倍的回退。

`libflutter.so` 与 `libapp.so` 的 ELF `PT_LOAD` 对齐为 64KB，满足 Android 15+ 的 16KB page size 要求。

## 构建

环境要求：Flutter 3.47+、JDK 17+、Android SDK（compileSdk 36）、minSdk 24。

```bash
flutter pub get
bash scripts/prefetch-flutter-engine.sh debug   # 首次构建前跑一次
flutter test                                    # 37 个 Dart 单测 + 界面渲染
flutter analyze                                 # 静态检查，当前零告警
bash scripts/build-release.sh                   # 发布包，默认三架构分包
bash scripts/build-release.sh universal         # 或三架构合一单包（约 21.2MB）
```

发布包走 `scripts/build-release.sh`，不要直接跑 `flutter build apk --release`。`--target-platform` 是唯一有效的 ABI 选择入口——写在 `gradle.properties` 或 `defaultConfig.ndk.abiFilters` 都无效，因为引擎库由 `CopyFlutterJniLibsTask` 按 `target-platform` 注入，绕过 ndk 过滤。

### 首次构建的网络坑

Gradle 从 `storage.googleapis.com/download.flutter.io` 拉 Flutter 引擎产物，国内直连常被限到 100KB/s 以下，一次构建要等半小时以上，而同一域名用 curl 却正常。于是脚本用 curl 并发预下载四个引擎产物到 `.flutter-m2/`（约 400MB，已忽略），`android/build.gradle.kts` 把它作为首选 maven 仓库、缺失时回落官方源；Maven 依赖走 `maven.aliyun.com` 镜像优先。

## 测试

| 层次 | 命令 | 结果 |
|------|------|------|
| Dart 单测 + 界面渲染 | `flutter test` | 37 条全过 |
| Kotlin 单测 | `./gradlew :app:testDebugUnitTest` | 58 条全过 |
| 真机端到端 | `flutter test integration_test/native_e2e_test.dart -d <id>` | 3 条全过（Android 10） |
| 静态检查 | `flutter analyze` | No issues found |
| 构建 | `scripts/build-release.sh` | 分包 6.6–7.3MB；universal 21.2MB |

覆盖的不只是顺途：金额与 token 格式化测了 null、NaN、Infinity、负数边界，且 Kotlin 侧 `Fmt.money` 与 Dart 侧分级一致——同一数字在界面与通知里写法相同；快照解析测了缺字段、类型错乱、非对象输入；CSV 解析测了引号内逗号、转义引号、紧凑日期形式；无凭据时不显示 0 元余额，而是配置引导。

尚未验证的一项：真实账号的线上取数。需要填真实 API Key 与 userToken 才能验，本机无可用凭据。

## 已知限制

- 平台网页接口非官方，DeepSeek 改版会失效。失效时余额仍可用，用量区显示「用量不可用」。
- 今日用量按本地时区 0 点起算，跨时区时与实际略有偏差。
- 后台刷新受系统省电策略影响，实际间隔可能长于设定值。
- 分 key 用量以平台 `api_key_name` 为键，本地重命名不改变平台侧名称。
- 各 key 用量之和与账户总量会因 free tier、过期赠送额等出现小额差异，属正常。

## 安装

安装包在 [Releases](https://github.com/cnefan31/ds-bar/releases) 页，按设备架构选一个：

| 文件 | 体积 | 适用 |
|------|------|------|
| `app-arm64-v8a-release.apk` | 7.2 MB | 绝大多数真机 |
| `app-armeabi-v7a-release.apk` | 6.6 MB | 32 位老机型 |
| `app-x86_64-release.apk` | 7.4 MB | 模拟器 |

签名证书为自签，安装时系统会提示「未知来源」。后续版本沿用同一证书，可直接覆盖升级。

```bash
adb install -r app-arm64-v8a-release.apk
```

仓库：[cnefan31/ds-bar](https://github.com/cnefan31/ds-bar)
