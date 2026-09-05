---
title: DCL
category: juc
aliases: [Double-Checked Locking, DCL 单例, 双重检查单例]
---

# DCL

## 思维链路速查

```chain
问题 | new 半初始化对象被发布 | 成因
屏障 | volatile 写插 StoreLoad | 核心
JDK 5 | JSR-133 之前不保 | 历史
落地 | volatile + 二次判空 | 实战
```

Double-Checked Locking(DCL)——单例懒加载的经典模式,核心靠 [[volatile]] 写后插入的 `StoreLoad` 屏障,**JDK 5 之前** volatile 不禁重排,DCL 会拿到「引用已赋值但对象未初始化」的半成品;JDK 5 起 `StoreLoad` 严格兜底,DCL 才安全。

## 它解决什么

| 问题 | 场景 |
|---|---|
| 半初始化对象发布 | `new Singleton()` 分「分配内存 → 初始化字段 → 引用赋值」三步,重排可能让引用先于初始化对其他线程可见 |
| 重复加锁开销 | 首次判空跳过 `synchronized`,只有竞争时才进锁 |
| 正确性 vs 性能 | 单例同时要懒加载 + 高并发读 + 低延迟,DCL 是唯一两手都抓的模式 |

> [!warning] 半初始化为什么危险
> `Singleton s = new Singleton()` 在没有 `StoreLoad` 屏障保护时,JIT/CPU 可能把步骤重排成「分配内存 → 引用赋值 → 初始化字段」。此时另一个线程进入首次判空会看到 `s != null`,直接拿去用——对象字段是默认值,方法可能抛 NPE 或返回错数据。

## 屏障机制

```mermaid
sequenceDiagram
    autonumber
    participant T1 as 写线程
    participant M as 主内存
    participant T2 as 读线程
    Note over T1: 进入 synchronized
    T1->>T1: 分配内存(memory=allocate())
    T1->>T1: 初始化字段
    T1->>T1: 引用赋值 instance=memory
    T1->>T1: 插入 StoreLoad 屏障<br/>禁后续 load/store 上提
    T1-->>M: instance 写回主内存
    Note over T2: 首次判空
    T2->>M: 读 instance
    M-->>T2: 返回非空引用
    Note over T2: 看到完整初始化的对象<br/>(屏障保证初始化的写也在 instance 之前)
    T2->>T2: 返回 s
```

> [!note] 为什么 volatile 写**后**插 `StoreLoad` 就够
> 重排风险只有一种形态:「`instance = s` 被重排到初始化之前」,即 volatile 写被提前到后续读/写之前。`StoreLoad` 正好挡这一刀——保证「写**之后**的所有读写都不能跨过该写上提」。而普通写与 volatile 写之间的重排(`StoreStore`),靠程序次序规则天然建立 happens-before(8 条规则全表见 [[JMM]]),**不需要**额外屏障。

## JDK 5 前后的语义差异

| 版本 | volatile 写屏障 | DCL 安全性 |
|---|---|---|
| JDK 1.4 及以前 | 不强制禁重排 | ❌ 可能拿到半初始化对象 |
| JDK 5+(JSR-133) | 写后插 `StoreLoad`,严格禁重排 | ✅ 安全 |
| JDK 8+ | 同上,模式无变化 | ✅ 安全 |

> [!tip] 谈 DCL 默认 JDK 5+
> 「DCL + volatile 单例」正确性只在 JSR-133 之后成立。面试答 DCL 要带「JDK 5 之后」这半句,否则会被追「那 JDK 5 之前呢」——旧 volatile 写无 `StoreLoad`,重排不被挡。

## 落地：DCL 模板

```java
public class Singleton {
    private static volatile Singleton instance;  // volatile 写后插 StoreLoad

    private Singleton() {}

    public static Singleton getInstance() {
        Singleton s = instance;             // 1. 首次判空(无锁)
        if (s == null) {
            synchronized (Singleton.class) { // 2. 竞争时才进锁
                s = instance;              // 3. 二次判空(防并发期间其他线程已建好)
                if (s == null) {
                    s = new Singleton();    // 4. 分配 + 初始化
                    instance = s;           // 5. volatile 写,禁重排
                }
            }
        }
        return s;
    }
}
```

> [!warning] 三步校验
> 1. **JDK ≥ 5**——`StoreLoad` 兜底的前提。
> 2. **`instance` 必须 volatile**——普通变量写无屏障,DCL 必坏。
> 3. **二次判空不能省**——第一次判空为了跳过锁,第二次判空为了防「线程 A 在等锁时,线程 B 已建好实例」。

<details>
<summary>面试问答 (3题)</summary>

Q：双重检查单例为什么要 volatile？
A：`new Singleton()` 分配内存/初始化/赋值引用三步可能被重排,volatile 写后的 `StoreLoad` 屏障禁该重排,保证其他线程拿到的是完整初始化的对象。

Q：DCL 为什么只在 JDK 5 之后才安全？
A：JDK 5 之前(JSR-133 之前)volatile 写不强制禁重排,引用可能先于初始化对其他线程可见,半初始化对象就被发布了。JSR-133 给 volatile 写加了 `StoreLoad` 屏障,才把 DCL 兜回安全。

Q：DCL 能否用 `AtomicReference` 或 `synchronized` 完全替代？
A：`AtomicReference` 加 `compareAndSet` 能写一个无 volatile 的懒加载单例,但代码更绕;全部用 `synchronized`/`ReentrantLock` 是正确但慢的方案,失去了 DCL「无竞争零开销」的意义。生产场景多用**饿汉 / 静态内部类 holder / 枚举**直接绕过 DCL 的复杂度。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：DCL 在任何 JDK 都安全。错,JDK 5 前 volatile 不禁重排,DCL 会拿到半初始化对象。
- 误区：`synchronized` 包整个方法就够了,不需要 volatile。错,`synchronized` 只对**同一把锁**的线程互斥,首次判空走无锁路径,看不到锁内字段的初始化结果。
- 误区：DCL 是单例最优解。错,Java 里更推荐**静态内部类 holder**或**枚举**,既天然懒加载又无 DCL 的屏障复杂度。

</details>
