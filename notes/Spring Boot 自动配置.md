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

自动配置一句话讲透：jar 里预埋一批 `@AutoConfiguration` 类，框架按 classpath 上有哪些类、容器里已经有哪些 bean、外部属性文件写了什么，逐条判定要不要装配——你只写业务 bean，缺的、该有的，框架替你补上。

## 入口：@SpringBootApplication 三合一

`@SpringBootApplication` 是三个注解的复合 stereotype，真正点燃自动配置的是 `@EnableAutoConfiguration`：

| 注解 | 职责 | 备注 |
|---|---|---|
| `@SpringBootConfiguration` | 标记这是配置源（本身是 `@Configuration`） | 让当前类被当作配置类 |
| `@ComponentScan` | 扫当前包及子包，把 `@Component`/`@Service` 收进容器 | 用户 bean 由此注册 |
| `@EnableAutoConfiguration` | 接入自动配置 | 内部 `@Import(AutoConfigurationImportSelector.class)`，导入候选清单 |

> [!note] 真正的开关是 @EnableAutoConfiguration
> 只想要自动配置、不要组件扫描时，可单独写 `@EnableAutoConfiguration`；纯 Spring Framework 没它，得手写 `@Configuration`。

`AutoConfigurationImportSelector` 被 `@Import` 后，在容器启动期把候选清单里的配置类批量导入。

## 候选清单：从 spring.factories 到 AutoConfiguration.imports

`AutoConfigurationImportSelector.getAutoConfigurationEntry()` 做的事：读取每个 jar 下的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，每行一个自动配置类的全限定名，`#` 开头是注释；再去重、按 exclude 与条件过滤。

```chain
扫所有 jar 的 imports 文件 | 收集候选类名 | 收集
去重 + 排除 spring.autoconfigure.exclude | 剪掉显式不要的 | 过滤
过 @Conditional 筛选 | 环境不满足的淘汰 | 裁剪
按 @AutoConfigureBefore/After 排序 | 决定装配先后 | 排序
导入容器 | 成为普通 @Configuration | 落地
```

| 版本 | 自动配置清单位置 | 说明 |
|---|---|---|
| Boot < 2.7 | `META-INF/spring.factories` 的 `EnableAutoConfiguration` key | 逗号分隔的类名 |
| Boot 2.7+ | `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` | 每行一个类名，官方推荐 |
| Boot 3.0 | `spring.factories` 自动配置支持**彻底删除** | 旧写法直接不生效 |

> [!warning] 2.7 是分水岭
> 自己的 starter 若还写 `spring.factories` 的 `EnableAutoConfiguration`，升到 3.0 后自动配置会整体失效——必须迁到 `AutoConfiguration.imports`。2.7 两格式并存过渡，3.0 二选一变成只剩新格式。

Boot 2.7+ 的自动配置类用 `@AutoConfiguration` 标注（它 meta 了 `@Configuration`，并自带 `before`/`after`/`beforeName`/`afterName` 排序属性），不再需要额外的 `@AutoConfigureBefore/After`。

> [!tip] 自动配置类禁止被组件扫描
> 它们必须只通过 imports 文件加载，要放在独立包、且类上绝不挂 `@Component`；否则会被扫两遍，还会破坏"用户配置先加载"的顺序前提。MyBatis 的 `MybatisAutoConfiguration` 正是这个套路——classpath 有 SqlSessionFactory 相关类才装配（详见 [[MyBatis]]）；事务的 `TransactionAutoConfiguration`、AOP 的 `AopAutoConfiguration`（详见 [[Spring AOP]]）同样如此。

性能细节：jar 里还有 `META-INF/spring-autoconfigure-metadata.properties`，键形如 `XAutoConfiguration.ConditionalOnClass=com.example.Need`，让过滤器**不加载配置类**就能先排除不满足的类，省启动开销。

## 条件生效：@Conditional 系列按环境裁剪

自动配置类上几乎都叠 `@Conditional` 注解——这就是"按需装配"的全部秘密。常用条件：

| 条件注解 | 满足才装配 | 典型用途 |
|---|---|---|
| `@ConditionalOnClass` | classpath 上存在指定类 | 有 MyBatis 才配 SqlSessionFactory |
| `@ConditionalOnMissingClass` | 指定类不存在 | 互斥技术栈二选一 |
| `@ConditionalOnBean` | 容器里已有某 bean | 依赖别人先就绪 |
| `@ConditionalOnMissingBean` | 容器里**没有**某 bean | 留口子给用户覆盖默认值 |
| `@ConditionalOnProperty` | 某属性等于/匹配某值 | `spring.jpa.show-sql=true` 才开 |
| `@ConditionalOnResource` | 存在某资源文件 | 有配置文件才装配 |
| `@ConditionalOnWebApplication` / `...NotWebApplication` | 是/不是 Web 应用 | Web 环境才配 MVC |
| `@ConditionalOnExpression` | SpEL 表达式为 true | 复杂组合判定 |
| `@ConditionalOnJava` | 特定 Java 版本 | 跨版本兼容 |
| `@ConditionalOnSingleCandidate` | 仅一个候选 bean（或 primary） | 注入点明确 |

> [!danger] 用户 bean 为什么能覆盖自动配置
> 自动配置里提供的 bean 几乎都标 `@ConditionalOnMissingBean`。用户 `@Configuration` 经 `@ComponentScan` 先于自动配置加载，条件判定时"已有该类型 bean"成立 → 自动配置那一份被跳过，于是用你写的。反过来想禁某自动配置，配 `spring.autoconfigure.exclude` 比手写空 bean 干净。

> [!warning] bean 条件只在自动配置类上可靠
> `@ConditionalOnBean`/`@ConditionalOnMissingBean` 按"已处理到这一步的 bean 定义"判定。用户 `@Configuration` 保证先于自动配置，所以放在自动配置类/方法上才稳；若放到普通业务配置类上，加载顺序不定，结果不可靠。

自动配置之间的先后由 `@AutoConfigureBefore`/`@AutoConfigureAfter`/`@AutoConfigureOrder` 决定（或 `@AutoConfiguration` 的 `before`/`after` 属性）；用户 `@Configuration` 永远排在自动配置之前。

## 配置绑定：@ConfigurationProperties 接外部属性

光装配 bean 不够，还得把 `application.properties`/`yml` 里的值灌进去——这是 `@ConfigurationProperties` 的活。

```java
@ConfigurationProperties(prefix = "myapp.datasource")   // prefix 锁定属性段
public class DataSourceProps {
    private String url;            // myapp.datasource.url 绑定进来
    private int maxPoolSize = 10;  // 默认值可先写好
    // getter/setter 必须存在，绑定靠它们
}
```

- 注册：类本身要成为 bean——要么兼 `@Component` 被扫到，要么 `@EnableConfigurationProperties(DataSourceProps.class)` 引入，要么 `@ConfigurationPropertiesScan` 扫包。绑定的活由 `ConfigurationPropertiesBindingPostProcessor` 干，它随 Boot 自动配置已注册好。
- **宽松绑定（relaxed binding）**：下面四种写法都映射到 `maxPoolSize`——

| 你写的属性 | 等价 |
|---|---|
| `myapp.datasource.max-pool-size` | ✅ |
| `myapp.datasource.maxPoolSize` | ✅ |
| `myapp.datasource.max_pool_size` | ✅ |
| `MYAPP_DATASOURCE_MAX_POOL_SIZE` | ✅（环境变量全大写） |

- `spring-boot-configuration-processor` 在编译期生成 `META-INF/spring-configuration-metadata.json`，给 IDE 提供补全与类型提示；额外元数据可写 `additional-spring-configuration-metadata.json`。
- 真正执行绑定的是 `Binder`（Boot 2.0+），`@ConfigurationProperties` 只是声明，绑定发生在 bean 后处理阶段。

> [!tip] @ConfigurationProperties vs @Value
> `@Value("${...}")` 适合零散取单个值、支持 SpEL；`@ConfigurationProperties` 把一整段属性绑成类型安全的对象，支持宽松绑定、元数据和 `@Validated` 校验，自动配置全用它。

## 调试：为什么没生效 / 怎么看

装配结果全记在 `ConditionEvaluationReport`：

- 启动加 `--debug`（或开 `debug=true`），日志打印 `Positive matches` / `Negative matches` / `Exclusions`——负匹配会写明哪条 `@Conditional` 没过。
- 跑 Actuator 的 `/actuator/conditions` 端点（需引入 actuator 并暴露）看同一份报告。
- 排除：在 `@SpringBootApplication(exclude = XAutoConfiguration.class)` 写死，或 `spring.autoconfigure.exclude=com.example.XAutoConfiguration` 写活；二者等价。

<details>
<summary>面试问答 (6题)</summary>

Q：@SpringBootApplication 由哪三个注解组成，各自干什么？

A：@SpringBootConfiguration（即 @Configuration，标记配置源）+ @ComponentScan（扫包把用户 bean 收进容器）+ @EnableAutoConfiguration（@Import(AutoConfigurationImportSelector) 点燃自动配置）。其中只有 @EnableAutoConfiguration 负责自动配置。

Q：自动配置类是怎么被发现的？spring.factories 和 AutoConfiguration.imports 什么关系？

A：容器启动期 AutoConfigurationImportSelector 扫每个 jar 的 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports，逐行读出自动配置类名。Boot 2.7 之前用 META-INF/spring.factories 的 EnableAutoConfiguration key（逗号分隔）；2.7 引入新格式并存，3.0 删除 spring.factories 自动配置支持，只剩新格式。

Q：为什么我写的 @Bean 能覆盖自动配置的 bean？

A：自动配置提供的 bean 几乎都标 @ConditionalOnMissingBean。用户 @Configuration 经 @ComponentScan 先于自动配置加载，条件判定时"已有该类型 bean"成立，自动配置那份被跳过。这是有意留的覆盖口子。

Q：@ConditionalOnClass 的 value 写真实类，类不在 classpath 不会炸吗？

A：不会。条件注解读取的是注解元数据、由 ASM 解析，value 只当字符串比对、不触发类加载，所以目标类不存在也不报 NoClassDefFoundError。但 @Bean 方法上用它时返回类型会被 JVM 先加载，类缺失照样炸——这种情况要单独抽个配置类隔离条件。

Q：@ConfigurationProperties 和 @Value 怎么选？

A：@Value 取单个值、可写 SpEL，适合零散场景；@ConfigurationProperties 把一整段属性绑成类型安全对象，支持宽松绑定、元数据补全和 @Validated 校验，自动配置统一用它。

Q：怎么排查某个自动配置没生效？

A：启动加 --debug，看日志的 Negative matches，会列出未生效的自动配置及命中的 @Conditional；或开 Actuator 的 /actuator/conditions 端点。要强制关掉某配置用 spring.autoconfigure.exclude。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：自动配置类上加了 @Component 也能被扫到。自动配置类必须只通过 imports 文件加载，挂 @Component 会被组件扫描重复注册，还破坏"用户配置先加载"的顺序前提，导致 @ConditionalOnMissingBean 失效。
- 误区：@ConditionalOnBean 放在业务 @Configuration 上能稳定控制顺序。它按"已处理到的 bean 定义"判定，业务配置加载顺序不定，结果不可靠；只在自动配置类/方法上才保证用户 bean 先就绪。
- 误区：升到 Boot 3.0 后 spring.factories 还能凑合用。3.0 已彻底删除 spring.factories 的自动配置支持，必须迁到 AutoConfiguration.imports，否则整个 starter 自动配置不生效。
- 误区：@ConfigurationProperties 不用写 getter/setter。绑定靠属性访问器，缺 getter/setter 字段绑不进去（构造函数绑定 @ConstructorBinding 除外）。

</details>
