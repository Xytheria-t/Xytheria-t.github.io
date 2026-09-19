---
title: Spring IoC
category: spring
---
# Spring IoC

:::lede
**IoC**（Inversion of Control，控制反转）是一种设计思想：把对象的创建与依赖组装从业务代码移交给容器，业务只声明「要什么」而不自己 `new`。
**载体与落地：** Spring 的载体是 IoC 容器（`BeanFactory` / `ApplicationContext`），DI（依赖注入）是它最常用的落地手段。
:::

## 思维链路速查

```chain
控制反转与容器 | 谁造对象、容器分几级 | 入口
BeanDefinition 与启动 | 先收配方，后造单例 | 机制
Bean 生命周期 | 填充→初始化→销毁 | 核心
注入方式与装配 | 三种注入、歧义消解 | 装配
循环依赖三级缓存 | 半成品外借与提前代理 | 陷阱
```

容器先收配方、后造对象：启动时把 BeanDefinition 收齐→改配方→备好加工钩子，末了一口气实例化所有非懒加载单例，依赖是在造的过程中灌进去的——注入失败、循环依赖、代理时机全由这条时序解释。

## 控制反转：反转的是获取依赖的方式

反转前业务自己 `new` 依赖、控制权在业务；反转后创建与组装权归容器，对象只声明要什么——容器造出来并管起来的对象叫 Bean。落地方式有两种：DI（容器把依赖注入进来，主流）与 DL 依赖查找（`getBean`/`ObjectProvider` 主动索取）。

容器是两级接口：

| 接口 | 能力 | 典型实现 |
|---|---|---|
| `BeanFactory` | 最小容器：`getBean`、装配、作用域 | `DefaultListableBeanFactory` |
| `ApplicationContext` | BeanFactory 之上加事件发布、国际化、资源加载、AOP/自动配置接入点 | `AnnotationConfigApplicationContext` |

> [!note] 实例化时机是选型的分水岭
> `BeanFactory` 懒加载（`getBean` 才造）；`ApplicationContext` 在启动时造完所有非懒加载单例（`refresh` 的 `finishBeanFactoryInitialization`）——启动慢一点，但配置错误在启动期就爆。

## BeanDefinition：容器拿到的是配方

注册进容器的是 **BeanDefinition**（配方），不是实例：类名、scope、lazy、构造参数与属性值、init/destroy 方法名、`depends-on`、`primary` 都记在这。来源有 XML `<bean>`、`@Component` 扫描、`@Bean`、`@Import`、自动配置 imports（详见 [[Spring Boot 自动配置]]）。

> [!tip] 改配方与改成品是两类扩展点
> `BeanFactoryPostProcessor` 作用对象是 **BeanDefinition**（`PropertySourcesPlaceholderConfigurer` 解析 `${}` 就是它）；`BeanPostProcessor` 作用对象是**实例**。前者改配方，后者加工成品。

## 容器启动：refresh 的主干四步

`AbstractApplicationContext#refresh()` 12 步，主干只有四步：

```chain
加载 BeanDefinition | 扫描/解析成配方注册进 BeanFactory | 1
执行 BeanFactoryPostProcessor | 改配方：占位符解析、自动配置导入 | 2
注册 BeanPostProcessor | 备好加工实例的钩子 | 3
finishBeanFactoryInitialization | 实例化全部非懒加载单例 | 4
```

> [!warning] 配方必须在第 2 步前收齐
> 后处理只能改已注册的配方；组件扫描先于自动配置执行，正是 `@ConditionalOnMissingBean` 判得准的前提（[[Spring Boot 自动配置]]）。

## Bean 生命周期

| 阶段 | 动作 | 可扩展点 |
|---|---|---|
| 实例化 | 构造器反射造对象，属性仍为空 | 实例化后把 `ObjectFactory` 存三级缓存 |
| 属性填充 | `populateBean`：`@Autowired`/`@Value`/`@Resource` 注入 | `InstantiationAwareBeanPostProcessor` |
| Aware 回调 | `BeanNameAware` → `BeanClassLoaderAware` → `BeanFactoryAware` | `ApplicationContextAware` 等在下一行 |
| 初始化前 | `BeanPostProcessor#postProcessBeforeInitialization` | `@PostConstruct` 在此执行 |
| 初始化 | `afterPropertiesSet` → `@Bean(initMethod)` | 顺序固定：注解 → 接口 → 方法 |
| 初始化后 | `postProcessAfterInitialization` | **AOP 代理在此生成**（[[Spring AOP]]） |
| 就绪 | 进单例池 `singletonObjects` | — |
| 销毁 | `@PreDestroy` → `DisposableBean#destroy` → `destroyMethod` | 只管 singleton |

> [!danger] 代理生成在初始化之后
> 拿到手的 bean 往往是代理，自调用失效、`final` 类代理失败都源于此时机（[[Spring AOP]]）；三级缓存要提前造代理，本质是绕开这一步。

## 注入方式与歧义消解

| 注入 | 官方立场 | 代价与适用 |
|---|---|---|
| 构造器 | 推荐（4.3 起单构造器可省 `@Autowired`） | 依赖可 `final`、易于单测、循环依赖启动即暴露 |
| setter | 可选依赖 | 允许重配，代价是可变 |
| 字段 | 不推荐 | 不可 `final`、单测得靠反射、循环依赖藏到运行期 |

`@Autowired` 的歧义消解顺序：按类型找候选 → `@Qualifier` 按名收窄 → 剩多个取 `@Primary` → 再取 `@Priority` 高者 → 最后回退字段名/参数名匹配 bean 名；`required` 默认 true，一个都没有就抛 `NoSuchBeanDefinitionException`。

| | `@Autowired` | `@Resource` |
|---|---|---|
| 来源 | Spring | JSR-250（`jakarta.annotation`） |
| 默认按 | 类型 | **名称**（缺省取字段名），找不到回退类型 |
| 消歧 | `@Qualifier`/`@Primary`/`@Priority` | 只有 `name`/`type` |
| `required=false` | 支持 | 不支持，找不到就抛 |
| 构造器注入 | 支持 | 不支持（只字段/setter） |

> [!tip] 单例里注入 prototype 拿不到新对象
> 注入只发生一次，prototype 退化成单例。要每次取新的：`ObjectProvider<T>.getObject()`、`@Lookup`，或 `proxyMode = ScopedProxyMode.TARGET_CLASS` 经代理解析。

## 循环依赖与三级缓存

| 缓存 | 存什么 | 时机 |
|---|---|---|
| 一级 `singletonObjects` | 成品 bean | 初始化完成 |
| 二级 `earlySingletonObjects` | 半成品的早期引用 | 首次被循环引用时从三级取出升级 |
| 三级 `singletonFactories` | 造早期引用的 `ObjectFactory` | 实例化后、填充前放入 |

```chain
A 实例化完成 | 把自己包成 ObjectFactory 放三级 | 1
A 填充要 B | 转而创建 B | 2
B 填充要 A | 从三级取早期引用给 B | 3
B 初始化完成 | 进一级缓存 | 4
A 拿到 B 并初始化 | 进一级缓存 | 5
```

三级存 `ObjectFactory` 而非半成品对象，是为了**延迟决定**：只有真被循环引用时才调 `getEarlyBeanReference` 提前造 AOP 代理，未卷入循环的 bean 仍在初始化后造代理，两条路径靠 `earlyProxyReferences` 去重。只有二级的话早期引用必是原始对象，B 拿到的 A 与最终成品不是同一个。

> [!danger] 三种情况解不了
> - 构造器注入：实例化阶段就要依赖，对象还没影、没有半成品可暴露 → `BeanCurrentlyInCreationException`。
> - `prototype`：容器不缓存 prototype，无缓存可借 → 直接抛。
> - Boot 2.6+ `spring.main.allow-circular-references` 默认 false，循环引用启动即失败。

修法：改构造器注入把问题顶到启动期、`@Lazy` 延迟一方实例化、抽第三个类把环拆成链。

## 落地：三种注入写法

```java
@Service
public class OrderService {
    private final PayClient pay;                  // 构造器注入：final + 启动即暴露环
    OrderService(PayClient pay) { this.pay = pay; }

    @Autowired(required = false)                 // setter：可选依赖
    public void setMetrics(Metrics m) { this.metrics = m; }

    @Resource(name = "redisTemplate")            // 同类型多个时按名指定
    private RedisTemplate<String, Object> redis;
}
```

<details>
<summary>面试问答 (4题)</summary>

Q：IoC 和 DI 是什么关系？

A：IoC 是思想——创建与组装权从业务代码移到容器；DI 是它的落地手段（另一种是依赖查找）。Spring 的 IoC 容器即 `BeanFactory`。

Q：ApplicationContext 与 BeanFactory 的区别？

A：BeanFactory 是最小容器、懒加载；ApplicationContext 在它之上加了事件发布、国际化、资源加载、AOP/自动配置接入，且默认启动时预实例化所有非懒加载单例。

Q：三级缓存为什么第三级存 ObjectFactory 而不是半成品？

A：为了延迟决定——只有真被循环引用时才提前生成 AOP 代理，未卷入的仍在初始化后生成，两条路径靠 `earlyProxyReferences` 去重；只有二级则早期引用是原始对象，与最终成品不是同一个。

Q：构造器注入的循环依赖为什么无解？

A：早期引用的暴露点在「实例化之后、属性填充之前」；构造器注入在实例化阶段就要依赖，那时对象尚未创建，没有半成品可借。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：Spring 能解决所有循环依赖。只解「单例 + setter/字段注入」；构造器注入、prototype 都不行，Boot 2.6+ 默认直接禁。
- 误区：字段注入和构造器注入没差。字段注入不能 `final`、单测靠反射塞值，还把循环依赖藏到运行期——官方立场是构造器优先。
- 误区：`@Resource` 按类型注入。它默认按名称（缺省取字段名），找不到才回退类型，且不支持 `required=false`。

</details>
