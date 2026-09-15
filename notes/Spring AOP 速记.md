---
title: Spring AOP 速记
category: spring
clip: true
---

Spring AOP 是 Spring 对 AOP（面向切面编程）的实现：把日志、事务、权限、缓存、监控等「横切关注点」从业务代码抽离，在方法执行前后等时机经代理动态织入，不改原业务代码（详见 [[Spring AOP]]）。

## 核心概念
| 概念 | 含义 |
| --- | --- |
| Aspect 切面 | 横切关注点的模块化（@Aspect 类） |
| JoinPoint 连接点 | 程序执行中可织入的时机（Spring 里只有方法调用） |
| Pointcut 切点 | 用表达式筛出哪些 JoinPoint 要织入 |
| Advice 通知 | 织入的时机与动作（@Before / @After / @Around 等） |
| Target 目标对象 | 被代理的原始对象 |
| Proxy 代理 | 织入后生成的代理对象 |
| Weaving 织入 | 把切面套到目标上生成代理的过程 |

## 连接点 vs 切点
连接点 = 所有可能织入的执行点；切点 = 用表达式从中筛出的子集。`execution(* com.demo.service..*(..))` 选出 service 包下所有方法作为切点，它们才是真正织入 Advice 的连接点。

## 失效边界
- 同类自调用：`this.methodB()` 的 `this` 是原始对象、绕开代理，增强失效（同 [[Transactional 速记]]）。
- `final` 类 / `final` 方法：CGLIB 生成不了子类代理，增强失效。
- 只能织入 Spring 容器管理的 Bean 的 public 方法。

## 典型应用
`@Transactional` 事务、`@Cacheable` 缓存、`@Async` 异步，以及统一日志 / 权限 / 监控，均在方法前后由 AOP 自动织入，业务方法只写业务。
