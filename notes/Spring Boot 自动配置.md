---
title: Spring Boot 自动配置
category: spring
---

# Spring Boot 自动配置

:::lede
自动配置依据 classpath、已有 Bean 与外部配置逐条裁定配置类是否生效，用户声明过的实现优先。
**条件：** `@ConditionalOnClass` / `@ConditionalOnMissingBean`
:::

## 思维链路速查

```chain
入口注解 | @SpringBootApplication 三合一 | 入口
候选清单 | 选择器读 imports 清单 | 核心
条件生效 | @Conditional 系列按环境裁剪 | 机制
配置绑定 | @ConfigurationProperties 绑属性 | 绑定
调试与面试 | 条件报告 + 考点 | 复盘
```

## 入口：@SpringBootApplication 三合一

`@SpringBootApplication` 是三个注解的复合 stereotype，真正点燃自动配置的是 `@EnableAutoConfiguration`：

| 注解 | 职责 | 产出 |
|---|---|---|
| `@SpringBootConfiguration` | 标记配置源（本身是 `@Configuration`） | 当前类成为配置类 |
| `@ComponentScan` | 从**启动类所在包**向下递归扫 `@Component` 派生注解 | 用户 bean 的 BeanDefinition |
| `@EnableAutoConfiguration` | `@Import(AutoConfigurationImportSelector.class)` | 自动配置候选导入 |

> [!note] @ComponentScan 的四条边界
> - 启动类放错包 → 子包 bean 全扫不进 → 报 `NoSuchBeanDefinition`；起点可用 `scanBasePackages` 改。
> - 只扫 `@Component` 派生：`@Service`/`@Repository`/`@Controller`/`@RestController`/`@Configuration`。
> - 产出 **BeanDefinition**（注册进 BeanFactory）而非实例，实例化留到 `finishBeanFactoryInitialization`。
> - 只认**包前缀**、与 jar 无关：自动配置类在 `org.springframework.boot.autoconfigure.*`，不在启动类前缀下 → 扫不到，只走 imports 加载；扫描先于自动配置，是 `@ConditionalOnMissingBean` 判得准的前提。

只要自动配置不要扫描：单独写 `@EnableAutoConfiguration`；纯 Framework 手写 `@Configuration`。

## 候选清单：从 spring.factories 到 AutoConfiguration.imports

清单文件在每个 jar 的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，每行一个全限定类名、`#` 为注释；读取者 `AutoConfigurationImportSelector.getAutoConfigurationEntry()` 扫完所有 jar、过滤排序后交回。

```chain
扫全部 jar 的 imports 文件 | 逐行读类名 | 收集
去重 + 剔除 spring.autoconfigure.exclude | 剪掉显式排除项 | 过滤
跑 @Conditional 系列筛选 | 环境不满足的淘汰 | 裁剪
按 @AutoConfigureBefore/After 排序 | 定装配先后 | 排序
交给 @Import 导入 | 成为普通 @Configuration | 落地
```

| 版本 | 清单位置 | 说明 |
|---|---|---|
| < 2.7 | `spring.factories` 的 `EnableAutoConfiguration` key | 逗号分隔类名 |
| 2.7 ~ 2.x | imports 文件（推荐） | 旧格式仍兼容 |
| 3.0+ | 只剩 imports 文件 | 旧 key 直接失效 |

- 自写 starter 若留旧 key，升级 3.0 后自动配置**静默失效**，必须迁 imports。
- 2.7+ 自动配置类用 `@AutoConfiguration` 标注（meta 了 `@Configuration`，自带 `before`/`after` 排序属性），不必再写 `@AutoConfigureBefore/After`。

> [!warning] 自动配置类绝不能被组件扫描
> 只经 imports 加载：放独立包、不挂 `@Component`。被扫进来会破坏「用户配置先加载」的顺序，`@ConditionalOnMissingBean` 失准。`MybatisAutoConfiguration`（详见 [[MyBatis]]）、`TransactionAutoConfiguration`、`AopAutoConfiguration`（详见 [[Spring AOP]]）都是这个套路。

## 条件生效：@Conditional 系列按环境裁剪

自动配置类上几乎都叠 `@Conditional` 注解：

| 条件注解 | 满足才装配 | 典型用途 |
|---|---|---|
| `@ConditionalOnClass` | classpath 上存在指定类 | 有 MyBatis 才配 SqlSessionFactory |
| `@ConditionalOnMissingClass` | 指定类不存在 | 互斥技术栈二选一 |
| `@ConditionalOnBean` | 容器里已有某 bean | 依赖别人先就绪 |
| `@ConditionalOnMissingBean` | 容器里**没有**某 bean | 留口子给用户覆盖默认值 |
| `@ConditionalOnProperty` | 某属性等于/匹配某值 | `spring.jpa.show-sql=true` 才开 |
| `@ConditionalOnWebApplication` | 是 Web 应用（`...NotWebApplication` 反之） | Web 环境才配 MVC |

> [!danger] 改自动配置行为的两条路
> ① 自己写个同类型 bean 顶掉——自动配置的 bean 几乎都标 `@ConditionalOnMissingBean`，容器里已有该类型时直接跳过；② `spring.autoconfigure.exclude=...` 整个排除，比手写空 bean 干净。

> [!warning] bean 条件只在自动配置类上可靠
> `@ConditionalOnBean`/`@ConditionalOnMissingBean` 按「已处理到这一步的 bean 定义」判定；用户 `@Configuration` 先于自动配置，故放在自动配置类/方法上才稳，放普通业务配置类上加载顺序不定、结果不可靠。

先后可用 `@AutoConfigureOrder` 微调。

## 配置绑定：@ConfigurationProperties 接外部属性

同一前缀的属性绑成类型安全对象，注入时按字段读：

```java
@ConfigurationProperties(prefix = "myapp.datasource")
public class DataSourceProps {
    private String url;            // ← myapp.datasource.url
    private int maxPoolSize = 10;  // 默认值
}
```

- 成为 bean 三选一：`@Component` 被扫到 / `@EnableConfigurationProperties(...)` / `@ConfigurationPropertiesScan` 扫包。
- 绑定由 `ConfigurationPropertiesBindingPostProcessor` 初始化前从 `Environment` 反射写入；真正干活的 `Binder` 自 Boot 2.0 起接手。
- 宽松绑定（relaxed binding）：`maxPoolSize` ↔ `max-pool-size` ↔ `max_pool_size` ↔ 环境变量 `MYAPP_DATASOURCE_MAX_POOL_SIZE`。
- IDE 补全靠 `spring-boot-configuration-processor` 编译期生成 `spring-configuration-metadata.json`。

| | `@Value("${...}")` | `@ConfigurationProperties` |
|---|---|---|
| 粒度 | 零散取单个值 | 一整段属性绑成对象 |
| 类型安全 | 弱（字符串转换） | 强 |
| 宽松绑定 / 校验 | 不支持 | 支持，可叠 `@Validated` |
| SpEL | 支持 | 不支持 |

自动配置全用后者。

## 调试：为什么没生效 / 怎么看

装配结果全记在 `ConditionEvaluationReport`：

- 启动加 `--debug`（或 `debug=true`），打印 `Positive matches` / `Negative matches` / `Exclusions`——负匹配写明哪条 `@Conditional` 没过。
- Actuator `/actuator/conditions` 端点（需引入并暴露）看同一份报告。
- 排除：`@SpringBootApplication(exclude = XAutoConfiguration.class)` 写死，或 `spring.autoconfigure.exclude=...` 写活，二者等价。

<details>
<summary>面试问答 (3题)</summary>

Q：自动配置类是怎么被发现的？spring.factories 和 AutoConfiguration.imports 什么关系？

A：扫各 jar 的 imports 文件逐行读类名；旧 `spring.factories` 2.7 并存、3.0 删除。

Q：为什么启动类要放在最外层包？

A：以启动类所在包为根向下递归，放窄扫不到其他模块；跨包写 `scanBasePackages`。

Q：@ConditionalOnClass 的 value 写真实类，类不在 classpath 不会炸吗？

A：不会——条件注解读元数据、ASM 解析，value 只作字符串比对、不触发类加载；但 `@Bean` 方法上用时返回类型会被 JVM 先加载，类缺失照样炸。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：@ConfigurationProperties 不用写 getter/setter。绑定靠属性访问器，缺了绑不进（`@ConstructorBinding` 除外）。
- 误区：升 3.0 后 spring.factories 还能用。3.0 已删除该支持，必须迁 imports，否则 starter 静默不装配。
- 误区：给自动配置类加 `@Component` 会更快生效。反而被扫描提前加载、跑到自动配置顺序前，`@ConditionalOnMissingBean` 失准。

</details>
