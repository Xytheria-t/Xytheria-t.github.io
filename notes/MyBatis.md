---
title: MyBatis
category: spring
excerpt: MyBatis 的取舍是「半自动」：SQL 留在 XML 里由开发者手写，连接、参数装配、结果映射、缓存全交给框架——没有实现类的 Mapper 接口靠动态代理跑 SQL，#{} 与 ${} 的分界就是预编译与字符串拼接。
---

# MyBatis

:::lede
MyBatis 是半自动的持久层框架：SQL 由开发者手写调优，框架只消除 JDBC 样板、装配参数并映射结果集。
**分界：** 只做映射不生成 SQL · 控制权留在开发者手里
:::

## 思维链路速查

```chain
动机与定位 | JDBC 模板代码的解药 | 入口
执行流程 | 一次查询穿到 JDBC 的四层 | 主线
Mapper 接口原理 | 无实现类靠动态代理 | 核心
#{} 与 ${} | 预编译与拼接的分界 | 防注入
缓存与延迟加载 | 两级缓存取舍 + N+1 | 考点
```

## 动机：JDBC 的模板代码

| JDBC 手写的样板 | MyBatis 接管为 |
|---|---|
| 建/关连接、异常处理、缓存自实现 | SqlSession 统一管理 + 内置两级缓存 |
| SQL 硬编码在字符串、手动 set 参、手动遍历 ResultSet | SQL 进 XML（与代码解耦）；#{} + PreparedStatement 填参；resultMap 自动映射 |

**ORM** 指表与对象互转：全自动（Hibernate）按注解生成 SQL 但不可控；业务 SQL 复杂需精细调优（见 [[MySQL 索引]]），可控的 MyBatis 成主流。

## 执行流程：一次查询穿到 JDBC

| 组件 | 角色 / 生命周期 |
|---|---|
| SqlSessionFactoryBuilder | 读配置建工厂；用完即弃 |
| SqlSessionFactory | 生产 SqlSession；应用级单例（重量级） |
| SqlSession | CRUD 会话入口；请求级，**线程不安全**，用完即关 |
| Executor | SqlSession 背后的执行器；每会话一个 |
| MappedStatement | 一条 SQL 的封装；启动时解析 XML 生成，全局共享 |

```chain
getMapper | 拿接口的代理对象 | 入口
MapperProxy | 接口名+方法名定位 MappedStatement | 找 SQL
Executor | 查缓存，未命中放行 | 执行
StatementHandler | 填参、发 PreparedStatement | 落 JDBC
ResultSetHandler | 行映射成对象返回 | 回填
```

三大 Handler（StatementHandler 建并执行 PreparedStatement、ParameterHandler 填参、ResultSetHandler 行映射）即 JDBC 三步分工；插件机制用拦截器链把四大对象各包一层动态代理，PageHelper 分页就在这层改写 LIMIT（见 [[动态代理]]）。

## Mapper 接口原理：无实现类怎么跑 SQL

接口没有实现类，Spring 却能注入并查出结果——注入的是**动态代理**：`@MapperScan` 扫包下接口 → 各接口注册成 MapperFactoryBean → 注入时 `getObject()` 返回 JDK Proxy（MapperProxy 实现 InvocationHandler）。

```java
@Mapper
public interface UserMapper {
    User selectById(@Param("id") Long id);
}
```

```xml
<mapper namespace="com.demo.mapper.UserMapper">  <!-- namespace = 接口全限定名 -->
  <select id="selectById" resultType="com.demo.entity.User"> <!-- id = 方法名，拼唯一 key -->
    SELECT id, name FROM user WHERE id = #{id}  <!-- #{} = 预编译占位 -->
  </select>
</mapper>
```

MapperProxy 的 invoke 按「接口全限定名 + 方法名」定位 MappedStatement 后走上一节流程，由这条唯一 key 推出三个约束：

| 推论 | 原因 |
|---|---|
| 接口方法不能重载 | 两个重载方法撞同一 key，映射不出两条 SQL |
| 多参数用 @Param 起名 | 参数名编译后丢失，只能按 param1、param2… 取 |
| 参数是 POJO/Map 时属性直取 | 整个对象作为参数传入，#{} 里写属性路径 |

- MapperProxy 的 invoke 没有 target，直接把方法调用翻译成 SQL——[[动态代理]] 里「handler 可不碰 target」的极端案例。

## #{} 与 ${}：预编译与拼接的分界

```java
#{id} // ? 占位：先编译后填参，永不参与语法解析
${col} // 拼接：值先进文本再编译，可改写 SQL 结构
```

```sql
SELECT * FROM user WHERE id = 1 OR 1=1   -- ${id} 传 "1 OR 1=1"：条件恒真，全表泄露
SELECT * FROM user WHERE id = ?          -- #{id} 同一输入：整体当一个值，匹配不到该串
```

| | #{} | ${} |
|---|---|---|
| 底层 | PreparedStatement 的 ? | 字符串拼接 |
| 时机 | 先编译后填参 | 值先进文本再编译 |
| 注入 | 安全 | 危险 |
| 适用 | 一切「值」 | 表名/列名/排序字段等「语法位」 |

> [!danger] ${} 的边界
> ? 只能占「值」，占不了表名、列名、ORDER BY 字段这类语法位置——动态表列名才用 ${}，且值必须白名单校验。LIKE 模糊别写 `'%${kw}%'`（注入），也别写 `'%#{kw}%'`（? 落在引号里成了字面量，永远查不到），正确写法 `LIKE CONCAT('%', #{kw}, '%')`。

## 缓存与延迟加载

| | 一级缓存 | 二级缓存 |
|---|---|---|
| 作用域 / 共享 | SqlSession 会话内 / 同会话复用 | namespace（一个 Mapper）/ 跨 SqlSession |
| 默认 | 开启（localCacheScope=SESSION） | 不生效，需 `<cache/>` 开启 |
| 清空 | 同会话增删改即清 | 该 namespace 任意增删改整区清空 |
| 写入时机 | 查询后立即 | 事务提交后（防未提交脏读） |

> [!warning] 二级缓存的两个坑
> 跨 namespace 多表查询：A 缓存存了 B 表数据，B 的增删改只清 B，A 命中旧数据 → 脏读；分布式下实例缓存互不可见 → 不一致。生产一般不开，交给 Redis（见 [[EasyOrange 缓存一致性]]）。

> [!note] 一级缓存为什么生产感知弱
> Spring 整合下每个请求都是新 SqlSession（SqlSessionTemplate），方法结束即关；只有同一事务（@Transactional）内共享时才真正生效。

| 机制 | 一句话 | 关键点 |
|---|---|---|
| 延迟加载 | 关联对象（association/collection + select 子查询）不随主查询加载，首次访问才发 SQL | 返回 Javassist/CGLIB 代理拦 getter 触发（`lazyLoadingEnabled=true`） |
| N+1 | 主查询查回 N 行各发一次子查询 = 1+N 次 SQL | 解法：JOIN 一次查回或 IN 批量 |

<details>
<summary>面试问答 (3题)</summary>

Q：MyBatis 为什么叫半自动 ORM？和 Hibernate 的区别？

A：SQL 手写可控可调优，框架只做参数装配与结果映射；Hibernate 全自动生成 SQL 但不可控。

Q：Mapper 接口没有实现类，为什么能注入并执行 SQL？

A：@MapperScan 把接口注册成 MapperFactoryBean，注入时返回 JDK 动态代理（MapperProxy），按「接口名 + 方法名」定位 MappedStatement。

Q：N+1 问题是什么？怎么解决？

A：嵌套子查询下主查询查回 N 行 → 共 1+N 次 SQL。解法：改 JOIN 一次查回配 resultMap，或子查询改一次 IN 批量。

</details>

<details>
<summary>常见误区 (2条)</summary>

- 误区：MyBatis 能防注入是框架自带能力。只有 #{} 走预编译防注入，${} 拼接照样注入。
- 误区：延迟加载返回完整对象。返回的是 Javassist/CGLIB 代理，首次访问关联属性才发子查询（转 JSON 时提前触发）。

</details>
