---
title: Spring AOP 速记
category: spring
clip: true
---

Spring AOP 把日志、事务、权限这类「横切关注点」从业务代码抽离，由代理在方法执行前后等时机动态织入（详见 [[Spring AOP]]）。

## 核心概念
| 概念 | 含义 |
| --- | --- |
| Aspect 切面 | 横切关注点的模块化（@Aspect 类） |
| JoinPoint 连接点 | 可织入的时机（Spring 里只有方法调用） |
| Pointcut 切点 | 用表达式筛出哪些 JoinPoint 要织入 |
| Advice 通知 | 织入的时机与动作（@Before / @After / @Around 等） |
| Target 目标对象 | 被代理的原始对象 |
| Proxy 代理 | 织入后生成的代理对象 |
| Weaving 织入 | 把切面套到目标上生成代理的过程 |

## 连接点 vs 切点
连接点 = 所有可能织入的执行点，切点 = 用表达式筛出的子集，如 `execution(* com.demo.service..*(..))`。

## 失效边界
- 同类自调用：`this.methodB()` 的 `this` 是原始对象、绕开代理，增强失效（同 [[Transactional 速记]]）。
- `final` 类 / `final` 方法：CGLIB 生成不了子类代理，增强失效。
- 只能织入 Spring 容器管理的 Bean 的 public 方法。

## 典型应用
`@Transactional`、`@Cacheable`、`@Async`，以及统一日志 / 权限 / 监控，均由 AOP 自动织入，业务方法只写业务。
