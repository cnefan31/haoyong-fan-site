---
title: "阿里云 SSL 证书面板"
description: "覆盖检测、申请、部署、续期全生命周期的阿里云证书管理面板，Go 单二进制 + 浏览器前端。"
technologies:
  - Go
  - Wails
  - ACME
  - 阿里云 API
featured: true
weight: 2
link: "https://github.com/cnefan31/aliyun-ssl-setup-web"
---

一个自托管的阿里云 SSL 证书管理面板。Go 单二进制常驻运行，浏览器就是前端，局域网内任何设备打开网址就能用。

> **参考来源**：本项目参考了 [luodaoyi/aliyun-ssl-setup](https://github.com/luodaoyi/aliyun-ssl-setup)（阿里云 SSL 证书全自动申请部署）的思路，在其基础上改造成 BS 架构，扩展了资源扫描、证书管家同步和面板化操作。

## 解决的问题

阿里云上证书散落在多个服务里：证书管家（CAS）、SLB、OSS、CDN、云解析 DNS。到期时间各不相同，谁来续、续完部署到哪，很容易漏。手动处理一次要跨好几个控制台，通配符证书还要考虑 SAN 复用。

这个面板把这些收拢到一处，覆盖 **检测 → 申请 → 部署 → 续期提醒** 全流程。

## 核心能力

**检测**：扫描 CAS / SLB / OSS / CDN / 云解析 DNS 五类资源，汇总所有证书的有效期和绑定关系，按剩余天数红橙绿分级。

**申请**：基于 lego 走 ACME DNS-01，支持 Let's Encrypt 和 ZeroSSL，自动写 TXT 验证记录，支持通配符与多域名 SAN。

**部署**：一键部署到 OSS 自定义域名、CDN 加速域名、SLB HTTPS 监听，完成后自动刷新检测结果。

**无人值守**：服务常驻即每日自动续期，阈值、执行时间、目标都可配置，结果支持邮件汇总。

## 关键设计

- **通配符跨服务复用**：按「原证书域名组合」分组，一张通配符证书覆盖的所有服务算一组只签一次，然后批量部署
- **SLB 精确匹配**：只替换当前证书已临期的 HTTPS 监听，不动其他监听
- **CAS 证书不自动续**：避免与阿里云托管证书的续期逻辑冲突
- **并发保护**：自动任务与手动操作共用忙锁，不会重复触发

## 界面

### 证书库存

汇总五类云资源的证书状态，支持来源筛选与搜索。

![证书库存](/images/projects/aliyun-ssl-setup-web/01-inventory.png)

### 实时检测进度

逐资源显示扫描阶段与进度。

![检测进度](/images/projects/aliyun-ssl-setup-web/02-scan-progress.png)

### 申请证书

ACME 全自动签发，可同步到证书管家。

![申请证书](/images/projects/aliyun-ssl-setup-web/03-apply.png)

![申请进度](/images/projects/aliyun-ssl-setup-web/04-apply-progress.png)

### 部署与日志

![部署进度](/images/projects/aliyun-ssl-setup-web/05-deploy-progress.png)

![运行日志](/images/projects/aliyun-ssl-setup-web/06-logs.png)

### 设置

续期阈值、邮件通知、ACME 账户等集中配置。

![设置页](/images/projects/aliyun-ssl-setup-web/07-settings.png)

## 架构

从 0.1.x 的 Wails 桌面版改造为 BS 架构：业务内核迁入 `internal/app`，前端新增 REST + SSE 适配层，领域层原样复用。

```
aliyun-ssl-setup-web/
├── main.go            # 服务入口（flag / env / 优雅退出）
├── embed.go           # 内嵌前端资源
├── internal/
│   ├── app/           # 配置、任务编排、忙锁、日志
│   ├── server/        # 路由、REST API、登录与鉴权
│   ├── events/        # SSE 事件广播
│   ├── aliyun/        # 阿里云 RPC 客户端 + 资源扫描
│   ├── acme/          # lego + DNS Provider
│   ├── deploy/        # OSS / CDN / SLB 部署
│   ├── notify/        # 邮件通知
│   └── store/         # 任务记录
├── frontend/dist/     # 单文件前端，无 npm 依赖
└── deploy/            # systemd 单元 + 安装脚本
```

## 部署（树莓派）

```bash
bash build.sh                     # 交叉编译 linux/arm64
sudo bash deploy/install.sh build/bin/sslpanel-linux-arm64
sudo cat /var/lib/sslpanel/INITIAL_PASSWORD.txt
```

浏览器打开 `http://<树莓派IP>:8080/` 即可。定时器在进程内，由 systemd 保证常驻，不需要额外配 cron。

> ⚠️ 面板持有阿里云 AccessKey，`/api/config` 会返回明文凭据，务必设置登录口令并只在可信网络访问。
