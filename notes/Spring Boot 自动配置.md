---
title: Spring Boot 自动配置
category: spring
---

# Spring Boot 自动配置

## 思维链路速查

```chain
入口注解 | @SpringBootApplication 三合一 | 入口
候选清单 | 选择器读 META-INF 清单 | 核心
条件生效 | @Conditional 系列按环境裁剪 | 机制
配置绑定 | @ConfigurationProperties 接外部属性 | 绑定
调试与面试 | 条件报告 + 高频考点 | 复盘
```

自动配置把「用一个技术要配哪些 bean」从使用者挪到 jar 提供方：starter 里预置一批 `@AutoConfiguration` 类，启动时先全量列出候选，再按当前环境（classpath 有什么、容器里已有什么、配置写了什么）逐条裁定生效与否。用户 bean 先于它们进容器，于是默认实现照补、你声明过的直接顶掉——「约定大于配置」就是这样落地的。

## 入口：@SpringBootApplication 三合一

`@SpringBootApplication` 是三个注解的复合 stereotype，真正点燃自动配置的是 `@EnableAutoConfiguration`：

| 注解 | 职责 | 产出 |
|---|---|---|
| `@SpringBootConfiguration` | 标记配置源（本身是 `@Configuration`） | 当前类成为配置类 |
| `@ComponentScan` | 从**启动类所在包**向下递归扫 `@Component` 派生注解 | 用户 bean 的 BeanDefinition |
| `@EnableAutoConfiguration` | `@Import(AutoConfigurationImportSelector.class)` | 自动配置候选导入 |

> [!note] @ComponentScan 的四条边界
> - 起点 = 启动类所在包，`scanBasePackages` 可改。启动类放错包 → 子包 bean 全扫不进 → 启动报 `NoSuchBeanDefinition`。
> - 扫的是 `@Component` 的派生：`@Service` / `@Repository` / `@Controller` / `@RestController` / `@Configuration`。
> - 产出是 **BeanDefinition**（注册进 BeanFactory），不是实例；实例化留到 `finishBeanFactoryInitialization`。
> - 只认**包前缀**、与在哪个 jar 无关：自动配置类的包名是 `org.springframework.boot.autoconfigure.*`，不在启动类包前缀下 → 扫不到，只能走 imports 文件加载。
> - 扫描先于自动配置执行，这是 `@ConditionalOnMissingBean` 判得准的前提（见下下节）。

只想要自动配置、不要组件扫描时，可单独写 `@EnableAutoConfiguration`；纯 Spring Framework 没它，得手写 `@Configuration`。

## 候选清单：从 spring.factories 到 AutoConfiguration.imports

清单文件在每个 jar 的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，每行一个全限定类名，`#` 开头是注释；读取者是 `AutoConfigurationImportSelector.getAutoConfigurationEntry()`——它扫完所有 jar、过滤排序后交回一批类名。

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

- 2.7 两格式并存，3.0 只剩新格式：自写 starter 若还留旧 key，升级后整个自动配置**静默失效**，必须迁 imports。
- 2.7+ 自动配置类用 `@AutoConfiguration` 标注（meta 了 `@Configuration`，自带 `before`/`after` 排序属性），不必再写 `@AutoConfigureBefore/After`。

> [!warning] 自动配置类绝不能被组件扫描
> 只经 imports 文件加载：放独立包、类上不挂 `@Component`。被扫进来会破坏「用户配置先加载」的顺序，`@ConditionalOnMissingBean` 随即失准。`MybatisAutoConfiguration`（详见 [[MyBatis]]）、`TransactionAutoConfiguration`、`AopAutoConfiguration`（详见 [[Spring AOP]]）都是这个套路。

## 条件生效：@Conditional 系列按环境裁剪

自动配置类上几乎都叠 `@Conditional` 注解——「按需装配」全靠它。高频条件：

| 条件注解 | 满足才装配 | 典型用途 |
|---|---|---|
| `@ConditionalOnClass` | classpath 上存在指定类 | 有 MyBatis 才配 SqlSessionFactory |
| `@ConditionalOnMissingClass` | 指定类不存在 | 互斥技术栈二选一 |
| `@ConditionalOnBean` | 容器里已有某 bean | 依赖别人先就绪 |
| `@ConditionalOnMissingBean` | 容器里**没有**某 bean | 留口子给用户覆盖默认值 |
| `@ConditionalOnProperty` | 某属性等于/匹配某值 | `spring.jpa.show-sql=true` 才开 |
| `@ConditionalOnWebApplication` | 是 Web 应用（`...NotWebApplication` 反之） | Web 环境才配 MVC |

> [!danger] 想改自动配置的行为：两条路
> ① 自己写个同类型 bean 顶掉——自动配置的 bean 几乎都标 `@ConditionalOnMissingBean`，它在容器里已有该类型时直接跳过；② `spring.autoconfigure.exclude=...` 整个排除，比手写空 bean 干净。

> [!warning] bean 条件只在自动配置类上可靠
> `@ConditionalOnBean`/`@ConditionalOnMissingBean` 按「已处理到这一步的 bean 定义」判定。用户 `@Configuration` 保证先于自动配置，所以放在自动配置类/方法上才稳；放到普通业务配置类上，加载顺序不定，结果不可靠。

先后还能用 `@AutoConfigureOrder` 微调；用户 `@Configuration` 永远排在自动配置之前。

## 配置绑定：@ConfigurationProperties 接外部属性

bean 装好了，值从哪来：`application.yml` 里同一前缀的属性被绑成类型安全对象，注入时按字段读。

```java
@ConfigurationProperties(prefix = "myapp.datasource")  // 锁定属性段
public class DataSourceProps {
    private String url;            // ← myapp.datasource.url
    private int maxPoolSize = 10;  // 默认值；必须有 getter/setter
}
```

- 成为 bean 三选一：`@Component` 被扫到 / `@EnableConfigurationProperties(DataSourceProps.class)` / `@ConfigurationPropertiesScan` 扫包。
- 绑定由 `ConfigurationPropertiesBindingPostProcessor`（Boot 已注册）在初始化前从 `Environment` 取值反射写入；`@ConfigurationProperties` 本身只是声明，真正干活的 `Binder` 在 Boot 2.0+ 接手。
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

- 启动加 `--debug`（或开 `debug=true`），日志打印 `Positive matches` / `Negative matches` / `Exclusions`——负匹配会写明哪条 `@Conditional` 没过。
- 跑 Actuator 的 `/actuator/conditions` 端点（需引入 actuator 并暴露）看同一份报告。
- 排除：`@SpringBootApplication(exclude = XAutoConfiguration.class)` 写死，或 `spring.autoconfigure.exclude=com.example.XAutoConfiguration` 写活，二者等价。

<details>
<summary>面试问答 (3题)</summary>

Q：自动配置类是怎么被发现的？spring.factories 和 AutoConfiguration.imports 什么关系？

A：启动期 `AutoConfigurationImportSelector` 扫每个 jar 的 `META-INF/spring/...AutoConfiguration.imports`，逐行读出类名。2.7 之前用 `spring.factories` 的 `EnableAutoConfiguration` key（逗号分隔），2.7 起新格式并存，3.0 删掉旧格式。

Q：为什么启动类要放在最外层包？

A：`@ComponentScan` 以启动类所在包为根向下递归，放窄了就扫不到其他模块的 `@Service`/`@Controller`。真要跨包就显式写 `scanBasePackages`。

Q：@ConditionalOnClass 的 value 写真实类，类不在 classpath 不会炸吗？

A：不会。条件注解读的是注解元数据、由 ASM 解析，value 只当字符串比对、不触发类加载。但 `@Bean` 方法上用它时返回类型会被 JVM 先加载，类缺失照样炸——要单独抽配置类隔离条件。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：@ConfigurationProperties 不用写 getter/setter。绑定靠属性访问器，缺了字段绑不进去（构造器绑定 `@ConstructorBinding` 除外）。
- 误区：升到 Boot 3.0 后 spring.factories 还能凑合用。3.0 已彻底删除它的自动配置支持，必须迁到 imports 文件，否则整个 starter 静默不装配。
- 误区：把自动配置类加 `@Component` 能让它更快生效。它会被组件扫描提前加载，跑到自动配置该有的顺序之前，`@ConditionalOnMissingBean` 判定随之失准。

</details>
