---
title: Spring AOP
category: spring
excerpt: AOP 把日志、事务这类横切逻辑写进切面，由容器运行期织回代理——切点从连接点里挑要拦的时机，通知决定拦住后做什么，增强全挂在代理上，绕过代理即失效。
---

# Spring AOP

:::lede
AOP 是对 OOP 的补充范式：把横跨多个模块的关注点封装成切面，由框架织回目标方法的执行过程。
**Spring 实现：** 运行期动态代理 · 只能拦方法执行
:::

## 动机：横切关注点

**横切关注点**（cross-cutting concern）指事务、日志、权限、限流这类逻辑——不属于任何单一业务方法，却以相同形态散布在大量业务方法里。

抽离后 `transfer` 看似丢了事务，但调用方拿到的是**代理对象**，事务在代理层织回：手写 [[静态代理]] 要为每个目标类配一个代理类；运行期自动生成（见 [[动态代理]]），才做到一次声明、处处生效。

## 概念五术语

| 术语 | 定义 | 日志切面里对应 |
|---|---|---|
| JoinPoint 连接点 | 程序执行中**可被拦截的时机**（候选池，与有没有切面无关） | 一次 service 方法执行 |
| Pointcut 切点 | 表达式**从候选池筛出子集**，回答「拦哪些」 | `execution(* com.demo.service..*.*(..))` |
| Advice 通知 | 命中后执行的**横切逻辑本身** | 记录入参、耗时 |
| Aspect 切面 | Pointcut + Advice 的**组装单位** | `@Aspect` 类 |
| Weaving 织入 | 把切面**套到目标上生成代理** | 容器启动时生成代理 bean |

## 连接点：JoinPoint 的两层身份

同一个词指两个东西：概念上的「可拦截时机」，与运行期传给通知方法的「这次拦截现场」。

| 层 | JoinPoint 是什么 | 由谁决定 |
|---|---|---|
| 概念层 | 可被拦截的时机全集——Spring 里 = 每个 bean 的 public 方法**执行** | 框架能力，与切面无关 |
| 筛选 | Pointcut 从全集里挑子集，命中的才被织入 | 表达式 |
| 运行期 | 每次命中现生成 `JoinPoint` 对象，装这次调用的现场，方法返回即失效 | 容器 |

三者关系：JoinPoint 是**候选**，Pointcut 决定**选谁**，Advice 是**在选中的连接点上跑的动作**。

`JoinPoint` 对象能拿到什么：

| 方法 | 拿到什么 |
|---|---|
| `getSignature()` | 方法签名；强转 `MethodSignature` 拿 Method、参数类型、方法注解 |
| `getArgs()` | 本次调用的实参数组 `Object[]` |
| `getTarget()` / `getThis()` | 被代理的**原始对象** / **代理对象**本身；this 与 target 之分野即自调用失效的缩影 |
| `getKind()` | 连接点类型，Spring 下恒为 `method-execution` |

`ProceedingJoinPoint extends JoinPoint`，只多 `proceed()` / `proceed(newArgs)`——**只有 @Around 能声明**，也是唯一能控制流程的入口。

> [!warning] JoinPoint 必须占通知方法的第一个参数位
> 任何通知方法都可把 `JoinPoint` 声明为第一个参数；非 @Around 用 `ProceedingJoinPoint` 启动即报 `...only supported for around advice`。

- 概念层在 Spring 里只有**方法执行（method execution）**一种；字段 get/set、构造器、异常处理属 AspectJ 领地。

## 五种通知

```java
@Aspect
@Component                                    // 切面自己仍须是 Spring bean
public class LogAspect {
    @Pointcut("execution(* com.demo.service..*.*(..))")
    public void logPointcut() {}              // 起名复用，通知按名引用

    @Before("logPointcut()")                  // 四种时机型通知同理，只差注解名与时机
    public void before(JoinPoint jp) {}       // JoinPoint 必须第一参

    @Around("logPointcut()")                  // 包裹全程，唯一能控制流程的
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long t = System.nanoTime();
        try { return pjp.proceed(); }         // 放行进链下一环
        finally { log(pjp.getSignature(), System.nanoTime() - t); }
    }
}
```

| 通知 | 时机 | 控制权 | 典型用途 |
|---|---|---|---|
| `@Around` | 包裹全程 | 改入参、改返回值、吞/转异常、跳过执行 | 事务、耗时、缓存、限流 |
| `@Before` | 目标前 | 无，只能观察 | 权限、参数校验 |
| `@AfterReturning` | 正常返回后 | `returning="ret"` 绑返回值，改引用无效 | 结果审计 |
| `@AfterThrowing` | 抛异常后 | `throwing="ex"` 绑异常，异常照常外抛 | 异常上报 |
| `@After` | 出口（finally） | 无，正常/异常都必到 | 释放资源 |

> [!danger] 不调 proceed()，目标方法静默不跑，也不报错
> @Around 头号翻车点；反过来「命中缓存就不 proceed、直接 return 缓存值」正是正解——想让目标执行就必须 proceed()。

## 切点表达式

`execution` 六段式，逐段看 `execution(* com.demo.service..*.find*(..))`：

| 段 | 值 | 含义 |
|---|---|---|
| 修饰符 | 省略 | 省略 = 任意 |
| 返回值 | `*` | 任意 |
| 包 | `com.demo.service..` | 本包及子包（`..` 跨层级） |
| 类 | `*` | 包下任意类 |
| 方法名 | `find*` | `find` 开头（`*` 任意） |
| 参数 | `..` | 任意个、任意类型 |

高频指示器：

| 指示器 | 匹配什么 | 示例 |
|---|---|---|
| `execution` | 方法签名（主力） | 见上 |
| `within` | 某类/某包内所有方法 | `within(com.demo.service..*)` |
| `@annotation` | **方法上**带某注解 | `@annotation(Transactional)` |
| `@within` | **类上**带某注解 | `@within(Service)` |
| `bean` | bean 名（Spring 扩展） | `bean(*ServiceImpl)` |

可用 `&&`、`||`、`!` 组合；最实用一招——注解实例绑进通知参数：

```java
@Before("@annotation(log)")   // 方法上标了 @Log 才生效，注解实例整体绑进 log
public void before(JoinPoint jp, Log log) { /* 直接读 log.value() */ }
```

## 执行顺序

同一 Aspect 内六个位置（5.2.7 / Boot 2.3 起固定）：

| 序 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 位置 | `@Around` 前半 | `@Before` | 目标方法 | `@AfterReturning` / `@AfterThrowing` | `@After` | `@Around` 后半 |

- 异常路径：第 3 步抛出 → `@AfterThrowing` → `@After`，异常继续外抛。
- 跨切面先后由 `@Order` 定：值小的切面在外层，先进后出。
- 报顺序先报版本：此前相对顺序依赖 `getDeclaredMethods()` 返回序。

## 织入与失效边界

织入 = 框架化地调 `Proxy.newProxyInstance` / `Enhancer.create`：通知方法是 handler 里的一段增强，`proceed()` 即 `method.invoke(target, args)`（JDK）/ `proxy.invokeSuper(obj, args)`（CGLIB）——机制见 [[动态代理]]。

- 选型：纯 Framework 有接口默认 JDK Proxy、无接口退 CGLIB；**Boot 2.0+ 一律 CGLIB**。
- 失效根因：**增强全挂在代理对象上，没走代理就没增强**。

| 场景 | 为什么失效 |
|---|---|
| 同类自调用 `this.methodB()` | `this` 是原始对象，不是代理；拦截器链根本没被触发 |
| `private` / `final` / `static` 方法 | 代理的字节码覆盖不了它们 |
| `new` 出来的对象 | 不归容器管，压根没有代理 |
| 目标类为 `final` | CGLIB 生成不了子类，代理都建不出来 |

修法（自调用）：拆到另一个类 / 注入自身代理 / `AopContext.currentProxy()`（需 `exposeProxy=true`）——[[Transactional 速记]] 的自调用失效是头号案例。

<details>
<summary>面试问答 (3题)</summary>

Q：JoinPoint 和 Pointcut 有什么区别？

A：JoinPoint 是可被拦截的时机（Spring 只有方法执行），是候选全集；Pointcut 是筛出子集的表达式，命中的才织入 Advice。

Q：Spring AOP 和 AspectJ 的区别？

A：Spring AOP 运行期代理织入，只拦方法调用、零编译成本；AspectJ 编译期/类加载期改字节码，字段、构造器、static 都能拦，代价是 ajc。@AspectJ 风格只借注解语法，底层仍是动态代理。

Q：@Around 相比 @Before + @After 的不可替代点？

A：只有它能控制流程：proceed() 决定目标执不执行、proceed(newArgs) 换入参、返回前改返回值、catch 后吞/转异常；其余四个只能观察。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：JoinPoint 就是切点。切点是筛选条件，JoinPoint 是被筛的候选时机——「规则」与「被选中的执行点」。
- 误区：@Before 里改 `getArgs()` 数组就能换入参。换入参只走 @Around 的 `proceed(newArgs)`。
- 误区：写了 @Aspect 就生效。切面类还须是 Spring bean；纯 Framework 还要 `@EnableAspectJAutoProxy`，Boot 已自动开启。

</details>
