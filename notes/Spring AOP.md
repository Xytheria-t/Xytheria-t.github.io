---
title: Spring AOP
category: spring
excerpt: AOP 把日志、事务这类横切逻辑写进切面，由容器运行期织回代理对象——切点决定拦谁，通知决定拦住后做什么，而增强全挂在代理上，绕过代理就全部失效。
---

# Spring AOP

## 思维链路速查

```chain
动机与五术语 | 横切逻辑抽走、由代理织回 | 入口
五种通知与顺序 | Around 独控全程，其余只能观察 | API
切点表达式 | execution 六段式 + 指示器组合 | 语法
织入原理 | 动态代理的应用层封装 | 核心
失效边界 | 没走代理就没增强 + 面试 | 陷阱
```

全篇主心骨只有一个：**增强全挂在代理对象上**——切点决定拦谁，通知决定拦住后干什么，而任何没经过代理的调用都拿不到增强。

## 动机：横切关注点

**横切关注点**（cross-cutting concern）指事务、日志、权限、限流这类逻辑——不属于任何单一业务方法，却以相同形态散布在大量业务方法里。

```java
public void transfer(TransferDto dto) {          // 抽离前：业务方法背一份事务模板
    try { begin(); doTransfer(dto); commit(); }  // 真正的业务只有 doTransfer 一行
    catch (Exception e) { rollback(); throw e; }
}
public void transfer(TransferDto dto) { doTransfer(dto); }   // 抽离后：事务由切面织回
```

抽离后 `transfer` 看似丢了事务，但调用方拿到的其实是**代理对象**，事务逻辑在代理层被织回：

- 手写 [[静态代理]] 也能织回，代价是一套增强 × N 个目标类要手写 N 个代理类。
- 运行期自动生成代理（机制见 [[动态代理]]），才能切面一次声明、处处生效。

## 概念五术语

| 术语 | 定义 | 日志切面里对应 |
|---|---|---|
| JoinPoint 连接点 | 程序执行中**可被拦截的时机**；Spring AOP 只支持「方法调用」 | 每次 service 方法调用 |
| Pointcut 切点 | 表达式**筛出一组 JoinPoint**，回答「拦哪些」 | `execution(* com.demo.service..*.*(..))` |
| Advice 通知 | 拦截后执行的**横切逻辑本身**，回答「拦住后做什么」 | 记录入参、耗时 |
| Aspect 切面 | Pointcut + Advice 的**组装单位** | `@Aspect` 类 |
| Weaving 织入 | 把切面**套到目标上生成代理**的过程 | 容器启动时生成代理 bean |

只能拦方法调用：代理类只能重写方法（见 [[动态代理]]），字段读写、构造器、`static` 方法都拦不住——那些是 AspectJ（编译期改字节码）的能力。

## 五种通知

```java
@Aspect
@Component                                     // 切面自己仍须是 Spring bean
public class LogAspect {
    @Pointcut("execution(* com.demo.service..*.*(..))")    // 起名复用，其他通知按名引用
    public void logPointcut() {}

    @Before("logPointcut()")      // 四种时机型通知同理，只是注解名与时机不同
    public void before(JoinPoint jp) {}

    @Around("logPointcut()")                  // 包裹全程，唯一能控制流程的
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long t = System.nanoTime();
        try { return pjp.proceed(); }   // 放行进链下一环；不调它目标方法不执行
        finally { System.out.println("cost " + (System.nanoTime() - t) + "ns"); }
    }   // proceed(newArgs) 换入参、返回前可改写返回值
}
```

| 通知 | 时机 | 能拿到 | 控制权 | 典型用途 |
|---|---|---|---|---|
| `@Around` | 包裹全程 | 全部（`ProceedingJoinPoint`） | 改入参、改返回值、吞/转异常、跳过执行 | 事务、耗时、缓存、限流 |
| `@Before` | 目标前 | `JoinPoint` 入参、签名 | 无，只能观察 | 权限、参数校验 |
| `@AfterReturning` | 正常返回后 | `returning = "ret"` 绑返回值 | 读返回值；改引用不生效 | 结果审计 |
| `@AfterThrowing` | 抛异常后 | `throwing = "ex"` 绑异常 | 只观察，异常照常外抛 | 异常上报 |
| `@After` | 出口（finally） | 入参、签名 | 无，正常/异常都必到 | 释放资源 |

> [!danger] 不调 proceed()，目标方法静默不跑，也不报错
> 这是 `@Around` 最常见的翻车点；反过来，缓存命中时「不 proceed、直接 return 缓存值」正是它的正确用法——return 什么由业务定，铁律只有一条：想让目标执行就必须调 `proceed()`。

## 切点表达式

`execution` 六段式，逐段看 `execution(* com.demo.service..*.find*(..))`：

| 段 | 值 | 含义 |
|---|---|---|
| 返回值 | `*` | 任意 |
| 包 | `com.demo.service..` | 本包及所有子包（`..` 跨任意层级） |
| 类 | `*` | 包下任意类 |
| 方法名 | `find*` | `find` 开头（`*` 任意） |
| 参数 | `..` | 任意个、任意类型 |

修饰符段与异常段可省略。常用指示器只留高频五个：

| 指示器 | 匹配什么 | 示例 |
|---|---|---|
| `execution` | 方法签名（主力） | 见上 |
| `within` | 某类/某包内所有方法 | `within(com.demo.service..*)` |
| `@annotation` | **方法上**带某注解 | `@annotation(org.springframework.transaction.annotation.Transactional)` |
| `@within` | **类上**带某注解 | `@within(org.springframework.stereotype.Service)` |
| `bean` | bean 名（Spring 扩展） | `bean(*ServiceImpl)` |

指示器可用 `&&`、`||`、`!` 组合。最实用的一招——注解值直接绑进通知参数：

```java
@Before("@annotation(log)")   // 方法上标了 @Log 才生效，注解实例整体绑进 log
public void before(JoinPoint jp, Log log) { /* 直接读 log.value() */ }
```

## 执行顺序

同一 Aspect 内（Spring 5.2.7 / Boot 2.3 起固定序）：

```chain
@Around 前半 | proceed() 之前的代码 | 1
@Before | 进场的最后关卡 | 2
目标方法 | 真正的业务逻辑 | 3
@AfterReturning | 拿到返回值（或 @AfterThrowing 拿到异常） | 4
@After | finally 语义，兜底必到 | 5
@Around 后半 | proceed() 之后的代码 | 6
```

异常路径把第 3 步换成「抛出」：`@AfterThrowing` → `@After` → 异常继续向外抛（`@Around` 不 catch 就跟着外抛）。

> [!danger] 报顺序先报版本
> 5.2.7 起（Boot 2.3+）才保证 `@AfterReturning`/`@AfterThrowing` 先于 `@After`（官方 #25186）；此前同切面 after 类通知的相对顺序依赖 `getDeclaredMethods()` 返回序，Java 7 起无保证。

跨切面的先后由 `@Order` 控制：**值小的切面优先级高，包在外层**——先进后出：

```chain
@Order(1) 切面 | 先进入、后退出 | 外层
@Order(2) 切面 | 后进入、先退出，贴近目标 | 内层
```

## 织入原理：动态代理的应用层封装

代理选型那边已有结论，这里只对位概念：

| AOP 概念 | 落到动态代理上是 |
|---|---|
| 通知方法 | handler / `MethodInterceptor` 里的一段增强逻辑 |
| 拦截器链 | handler 内按序执行的增强序列 |
| `@Around` 的 `proceed()` | `method.invoke(target, args)`（JDK）/ `proxy.invokeSuper(obj, args)`（CGLIB） |
| 织入 | `Proxy.newProxyInstance` / `Enhancer.create` 的框架化调用 |

代理选型速记：纯 Spring Framework 有接口默认 JDK Proxy，无接口退 CGLIB；**Boot 2.0+ 默认 `proxyTargetClass=true`，一律 CGLIB**。调用代理方法 = 依次过拦截器链，`proceed()` 即「调用下一环」。

## 失效边界

根因只有一句：**增强全挂在代理对象上，没走代理就没增强**。

| 场景 | 为什么失效 |
|---|---|
| 同类自调用 `this.methodB()` | `this` 是原始对象，不是代理；拦截器链根本没被触发 |
| `private` / `final` / `static` 方法 | 代理的字节码覆盖不了它们（详见 [[动态代理]]） |
| `new` 出来的对象 | 不归容器管，压根没有代理 |
| 目标类为 `final` | CGLIB 生成不了子类，代理都建不出来 |

修法（都是针对自调用）：拆到另一个类、注入自身代理，或 `AopContext.currentProxy()`（需开启 `exposeProxy = true`）——`@Transactional` 自调用失效就是这一条的头号案例。

<details>
<summary>面试问答 (3题)</summary>

Q：Spring AOP 和 AspectJ 的区别？

A：Spring AOP 运行期动态代理织入，只拦方法调用，零额外编译成本；AspectJ 编译期/类加载期改字节码，连字段、构造器、static 方法都能拦，代价是要用 ajc 编译器。Spring 的 @AspectJ 风格只借了注解语法，底层仍是动态代理。

Q：@Around 相比 @Before + @After 的不可替代点？

A：只有 @Around 能控制流程：proceed() 决定目标执不执行、proceed(newArgs) 换入参、返回前改写返回值、catch 后吞/转异常，其余四个时机型通知全部只能观察。事务提交回滚、缓存命中跳过执行、限流拒绝都必须 @Around。

Q：同类自调用为什么失效？

A：增强挂在代理上，同类里 this.methodB() 的 this 是原始对象，调用没经过代理，拦截器链不触发。

</details>

<details>
<summary>常见误区 (2条)</summary>

- 误区：@AfterReturning 里给返回值参数重新赋值能改结果。改的只是绑定副本的指向，调用方拿到的还是原返回值；但返回值是可变对象时改它的字段会生效（同一引用）。
- 误区：写了 @Aspect 注解切面就生效。切面类还必须是 Spring bean（@Component 或 @Bean 注册）；纯 Spring Framework 还要 @EnableAspectJAutoProxy，Boot 已自动开启。

</details>
