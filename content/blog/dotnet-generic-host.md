---
title: "【.Net 学习笔记】创建通用主机程序"
slug: "dotnet-generic-host"
date: 2023-12-06
description: "使用 .NET 通用主机（Generic Host）搭建控制台程序，集成依赖注入、NLog 日志与 IHostedService。"
summary: "使用 .NET 通用主机（Generic Host）搭建控制台程序，集成依赖注入、NLog 日志与 IHostedService。"
tags:
  - dotnet
  - csharp
draft: false
---

## 1. 创建控制台项目

![](/images/blog/dotnet-generic-host/img-1.png)

![](/images/blog/dotnet-generic-host/img-2.png)

> 添加 nuget 包依赖
> ![](/images/blog/dotnet-generic-host/img-3.png)

```xml
    <ItemGroup>
        <PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.0"/>
        <PackageReference Include="Microsoft.Extensions.Hosting.Abstractions" Version="8.0.0"/>
        <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" Version="8.0.0"/>
        <PackageReference Include="NLog.Extensions.Logging"  Version="5.3.3" />
    </ItemGroup>
```

## 2. 修改 Program.cs 文件

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

using NLog.Extensions.Logging;

namespace Lesson01;

internal class Program
{
    private static async Task Main(string[] args)
    {
        await CreateHostBuilder(args).Build().RunAsync();
    }

    public static IHostBuilder CreateHostBuilder(string[] args)
    {
        return Host.CreateDefaultBuilder(args)
                    .ConfigureHostOptions(options =>
                    {
                        options.ShutdownTimeout = TimeSpan.FromSeconds(30);
                        options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
                    })
                    .ConfigureHostConfiguration(configure =>
                    {
                        //configure.AddJsonFile("appsettings.json", true);
                    })
                    .ConfigureServices((services) =>
                    {
                        // add logger service
                        services.AddLogging(configure =>
                        {
                            configure.ClearProviders();
                            configure.AddNLog("nlog.config");
                        });
                    });
    }
}
```

## 3. 添加通用主机

## 4. 添加日志及配置文件

```csharp
       // add logger service
       services.AddLogging(configure =>
       {
           configure.ClearProviders();
           configure.AddNLog("nlog.config");
       });
```

![](/images/blog/dotnet-generic-host/img-4.png)

```xml
<?xml version="1.0" encoding="utf-8" ?>
<nlog xmlns="http://www.nlog-project.org/schemas/NLog.xsd"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      autoReload="true"
      throwExceptions="false"
      internalLogLevel="Off" internalLogFile="c:\temp\nlog-internal.log">

    <!-- optional, add some variables
  https://github.com/nlog/NLog/wiki/Configuration-file#variables
  -->

    <!--
  See https://github.com/nlog/nlog/wiki/Configuration-file
  for information on customizing logging rules and outputs.
   -->
    <targets>
        <!-- info log -->
        <target xsi:type="File"
                name="Information"
                encoding="UTF-8"
                layout="${longdate:format=yyyy-MM-ddTHH:mm:ss.fffZ} |${level:uppercase=true:padding=-5}| ${message} ${exception}"
                fileName="${basedir}/logs/message.log"
                archiveFileName="${basedir}/logs/message.{####}.log"
                archiveNumbering="Rolling"
                archiveAboveSize="10485760"
                concurrentWrites="true"
                maxArchiveFiles="20"
                keepFileOpen="true" />
        <target xsi:type="File"
                name="microsoft"
                encoding="UTF-8"
                layout="${longdate:format=yyyy-MM-ddTHH:mm:ss.fffZ} |${level:uppercase=true:padding=-5}| ${logger} | ${message} ${exception}"
                fileName="${basedir}/logs/microsoft.log"
                archiveFileName="${basedir}/logs/microsoft.{####}.log"
                archiveNumbering="Rolling"
                archiveAboveSize="10485760"
                concurrentWrites="true"
                maxArchiveFiles="20"
                keepFileOpen="true" />
    </targets>

    <!-- network log -->

    <targets>
        <target name="Net_Info" xsi:type="Network" address="tcp://localhost:4001"/>
        <target name="Net_Error" xsi:type="Network" address="tcp://localhost:4002"/>
        <target name="Net_Warn" xsi:type="Network" address="tcp://localhost:4003"/>
    </targets>

    <!-- console log -->
    <targets>
        <!-- write log message to console
    EventId_Id=1001, EventId_Name=TestHostedService, EventId=TestHostedService| TestHostedService-->
        <target xsi:type="ColoredConsole" name="simplify" useDefaultRowHighlightingRules="false"
                  layout="[${longdate}] |${level}| ${message}">
            <highlight-row condition="level == LogLevel.Debug" foregroundColor="DarkGray" />
            <highlight-row condition="level == LogLevel.Info" foregroundColor="Green" />
            <highlight-row condition="level == LogLevel.Warn" foregroundColor="Yellow" />
            <highlight-row condition="level == LogLevel.Error" foregroundColor="Red" />
            <highlight-row condition="level == LogLevel.Fatal" foregroundColor="Red" backgroundColor="White"/>
        </target>
    </targets>

    <rules>
        <!-- add your logging rules here -->
        <logger name="Lesson01.*" minlevel="Debug" writeTo="Information" />
        <logger name="Lesson01.*" minlevel="Debug" writeTo="simplify" />
        <logger name="Microsoft.Extensions.*" minlevel="Debug" writeTo="Information" />
        <logger name="Microsoft.Hosting.*" minlevel="Trace" writeTo="simplify" />
    </rules>
</nlog>
```

## 5. 添加 IHostedService/BackgroundService

添加 **GreetingService**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lesson01;

public class GreetingService : BackgroundService
{
    private readonly ILogger<GreetingService> m_Logger;
    private readonly IHostApplicationLifetime m_ApplicationLifetime;

    public GreetingService(ILogger<GreetingService> logger,
                              IHostApplicationLifetime applicationLifetime)
    {
        m_Logger = logger;
        m_ApplicationLifetime = applicationLifetime;

        m_ApplicationLifetime.ApplicationStarted.Register(async () => { await OnStarted().ConfigureAwait(false); });
        m_ApplicationLifetime.ApplicationStopping.Register(OnStopping);
        m_ApplicationLifetime.ApplicationStopped.Register(OnStopped);
    }

    public override async Task StartAsync(CancellationToken token)
    {
        await base.StartAsync(token);
    }

    public override async Task StopAsync(CancellationToken token)
    {
        await base.StopAsync(token);
    }

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        PeriodicTimer timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
        while (!token.IsCancellationRequested && await timer.WaitForNextTickAsync(token))
        {
            m_Logger.LogWarning("Hello World!");
        }
    }

    #region Override Methods
    private async Task OnStarted()
    {
        m_Logger.LogInformation("OnStarted has been called.");
        await Task.CompletedTask;
    }

    private void OnStopping()
    {
        m_Logger.LogInformation("OnStopping has been called.");
    }
    private void OnStopped()
    {
        m_Logger.LogInformation("OnStopped has been called.");
    }
    #endregion
}
```

将 GreetingService 添加到容器中

```csharp
  // add hosted server 
  services.AddHostedService<GreetingService>();
```

## 6. 启动程序

![](/images/blog/dotnet-generic-host/img-5.png)
