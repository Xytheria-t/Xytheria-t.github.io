---
title: Java 泛型
category: javase
aliases: [泛型, 泛型擦除, generics]
---

# Java 泛型

## 思维链路速查

```chain
为什么需要泛型 | 检查前移到编译期 | 动机
泛型语法速查 | 类/方法/边界 | 速查
类型擦除 | 运行时的真相 | 核心
通配符与 PECS | 读写方向 | 难点
面试问答 | 高频考点 | 复盘
```

泛型的全部内容围绕一次「搬家」：类型检查从运行时搬到编译期。搬家靠**擦除**实现——编译完类型参数就没了，只剩 Object 与编译器自动插入的强转；立住这条真相，通配符的读写方向（PECS）就是推论而不是口诀。

## 为什么需要泛型

泛型 = 类型参数化：把「容器/方法操作什么类型」写成参数 `<T>` 交给编译器，编译期完成检查，使用处免去强制转换。

| 对比维度 | 无泛型 | 泛型 |
|---|---|---|
| **类型检查** | 运行时抛 `ClassCastException` | 编译期报错 |
| **取值方式** | `(String) list.get(0)` | 直接使用 |
| **安全性** | 装错类型运行时才炸 | 错误拦在编译期 |

> [!note] 类型参数只能是引用类型
> `List<int>` 编译不过——擦除后类型参数要替换成 Object，而 int 不是 Object 的子类。基本类型一律走包装类，装箱时机见 [[基本数据类型]]。

> [!tip] 泛型最大的用户是集合
> `List` / `Map` / `Set` 的元素类型声明全靠泛型兜底，接口形状见 [[Java Collection]]。

## 泛型语法速查

| 字母 | 含义 | 典型位置 |
|---|---|---|
| T | Type，类型 | 通用占位 |
| E | Element，元素 | List、Set |
| K / V | Key / Value | Map |
| R | Return，返回值 | 方法返回类型 |
| ? | 未知类型 | 通配符，见下文 |

| 形态 | 写法 | 说明 |
|---|---|---|
| 泛型类 | `class Box<T> { T value; }` | T 随对象确定 |
| 泛型接口 | `interface Comparable<T>` | 实现类指定 T |
| 泛型方法 | `<T> T first(List<T> list)` | T 由实参推断 |
| 多类型参数 | `class Pair<K, V>` | 逗号分隔 |
| 类型边界 | `<T extends Comparable<T>>` | T 限定为上界的子类型 |
| 原始类型 | `List list = new ArrayList()` | 裸类型，绕过泛型检查 |

> [!warning] 边界只写 extends
> Java 没有 `<T implements X>` 写法：上界无论写类还是接口都用 `extends`，多个上界用 `&` 连接——`<T extends Comparable<T> & Serializable>`，且 `&` 之后只准接接口、类至多一个并必须排第一。类型参数只有上界，下界 `super` 只出现在通配符里（见下文）。

## 类型擦除

擦除 = 编译器生成字节码时把类型参数丢掉，换成上界（没写上界就是 Object），再在使用处自动插入强制转换。因此 `List<String>` 与 `List<Integer>` 在运行时是**同一个 Class**。

```java
// 你写的
List<String> list = new ArrayList<>();
list.add("hi");
String s = list.get(0);

// 编译后的等价形态
List list = new ArrayList();        // <String> 没了
list.add("hi");                     // 实际签名 add(Object)
String s = (String) list.get(0);    // 编译器自动插入的强转
```

擦除的推论（全部编译期拦截）：

| 限制写法 | 原因 |
|---|---|
| `new T()` ❌ | 运行时不知道 T 是谁 |
| `new T[10]` ❌ | 擦除后无类型可查 |
| `x instanceof List<String>` ❌ | 运行时只有 List |
| `T.class` ❌ | 类型参数不是运行时实体 |
| `static T x` ❌ | 静态字段需随 T 各存一份 |

> [!note] 擦除是「半擦」：擦的是「用」，留的是「声明」
> - **擦掉的**：对象身上的类型参数。`new ArrayList<String>()` 运行时就是裸 ArrayList，`getClass()` 只能问出 `ArrayList`，这个对象当初按 `List<String>` 创建无人知晓——上一张表的禁写全由此而来。
> - **留底的**：声明处的泛型原样存进 class 文件的 Signature 属性（JVM 专门记录泛型签名的元数据）——类头（`extends Box<String>`）、字段声明、方法签名（参数/返回值）都算；反射 `getGenericSuperclass()` / `getGenericType()` 读的就是这份底。
> - **分界线**：底存在字节码的声明元数据里，不存在对象上。JSON 库 `new TypeReference<List<User>>() {}` 能拿到 `List<User>`，靠的是匿名子类自己是一个新类，类头的 Signature 记死了父类类型参数——读的是它的声明，不是某个运行中对象。

## 通配符与 PECS

PECS（Producer Extends, Consumer Super：生产者用 extends、消费者用 super）是通配符选型口诀，推导它之前先立住前提——**泛型是不变的**（invariant）：即使 String 是 Object 的子类，`List<String>` 与 `List<Object>` 之间也没有子类型关系。

```java
List<Object> objs = new ArrayList<String>();   // 编译错
```

| 对比维度 | 数组 | 泛型 |
|---|---|---|
| **子类型** | 协变：`String[]` → `Object[]` | 不变：`List<String>` ≠ `List<Object>` |
| **类型检查** | 运行时 | 编译期 |

| 通配符 | 含义 | 可写 | 可读 |
|---|---|---|---|
| `? extends T` | T 或其子类 | ❌ | ✅ 按 T |
| `? super T` | T 或其父类 | ✅ T 及其子类 | ❌ 仅 Object |
| `?` | 未知类型 | ❌ | ❌ 仅 Object |

```java
// extends：能读不能写
List<? extends Number> read = new ArrayList<Integer>(); // OK
Number n = read.get(0);      // OK：不管装谁，一定是 Number 的子类
// read.add(1);              // 编译错：万一实际是 List<Double> 呢

// super：能写不能读（读出来只能是 Object）
List<? super Integer> write = new ArrayList<Number>();  // OK
write.add(1);                // OK：Integer 放进 Number 的容器合法
// Integer i = write.get(0); // 编译错：里面可能是 Number、Object
```

> [!warning] 读写不对称的根源
> 通配符只约定「某个未知类型」：extends 视角下写入任何具体类都可能撞上实际类型，编译器干脆禁写；super 视角下写入 Integer 及其子类一定合法（子类可当父类用），读出时却只知道是 Object。

```branch
01: 选择通配符
02: 按数据流向分流
- 只读 | extends | 生产者 Producer
- 只写 | super | 消费者 Consumer
- 又读又写 | 精确类型 | 不用通配符
```

> [!tip] 标准库范例
> `Collections.copy(List<? super T> dest, List<? extends T> src)`：src 只出数据是生产者，dest 只收数据是消费者，一个签名把 PECS 用全。

## 落地：易错点代码

> [!note] 四组对照
> 不变 vs 数组协变、擦除四连、通配符读写、原始类型绕检查。

```java
// 1. 泛型不变 vs 数组协变：一个编译期拦下，一个运行时翻车
List<Object> a = new ArrayList<String>();   // 编译错
Object[] arr = new String[]{"x"};
arr[0] = 42;                                // ArrayStoreException

// 2. 擦除四连：编译期就拦下
// T obj = new T();                         // 编译错
// T[] xs = new T[10];                      // 编译错
// if (x instanceof List<String>) {}        // 编译错
// class Box<T> { static T x; }             // 编译错

// 3. 通配符读写规则
List<? extends Number> read = new ArrayList<Integer>();
Number n = read.get(0);                     // 只读 OK
List<? super Integer> write = new ArrayList<Number>();
write.add(1);                               // 只写 OK

// 4. 原始类型绕过检查：unchecked 警告的来源
List raw = new ArrayList<String>();         // unchecked 警告
raw.add(42);                                // 混入 Integer，无人拦
String s = (String) raw.get(0);             // ClassCastException，运行时才炸
```

<details>
<summary>面试问答 (6题)</summary>

Q：什么是类型擦除？为什么设计成擦除而不是保留泛型？

A：编译器把类型参数替换成上界（无上界则 Object），并在使用处自动插入强转。目的是二进制兼容：旧类库无需重新编译即可与泛型代码互操作，代价是运行时拿不到类型参数，`List<String>` 与 `List<Integer>` 是同一个 Class。

Q：泛型信息完全丢失了吗？JSON 库怎么拿到 `List<User>` 的类型？

A：没全丢。声明侧（类继承、方法签名、字段）的泛型写进字节码 Signature 属性，反射 `getGenericSuperclass()` 可读；`new TypeReference<List<User>>() {}` 用匿名子类把类型固定在声明侧，运行时即可取到。运行中对象的实际装的内容（instanceof、getClass 泛型参数）拿不到。

Q：PECS 是什么？举个例子。

A：Producer Extends, Consumer Super。只读的容器（生产者）用 `? extends T`，只写的容器（消费者）用 `? super T`；又读又写就用精确类型。如 `Collections.copy(List<? super T> dest, List<? extends T> src)`。

Q：为什么 `List<int>` 编译不过？

A：擦除后类型参数替换为 Object，只能装引用类型；基本类型须用包装类，伴随自动装箱开销。

Q：`List<String>` 和 `List<Integer>` 运行时是同一个类吗？

A：是。擦除后都是 List，`getClass()` 相同，静态成员共享。泛型的编译期检查是纯编译器行为，运行时无类型可查。

Q：桥方法是什么？

A：擦除导致实现与接口的签名不一致：实现 `Comparable<String>` 写的是 `compareTo(String)`，接口擦除后要求 `compareTo(Object)`。编译器自动生成一个 `compareTo(Object)` 桥方法转发到具体实现，多态才不中断。

Q：泛型在实际项目中有哪些应用？

A：常见应用：
1. 集合类型安全：`List<User>`、`Map<String, Object>` 等
2. 泛型工具类：`Optional<T>`、`Result<T>`、`Page<T>` 等封装通用逻辑
3. 框架设计：Spring 的 `@Autowired`、MyBatis 的 `Mapper<T>` 等
4. 类型安全的 Builder 模式：链式调用时保持类型信息
5. 序列化/反序列化：Jackson 的 `TypeReference`、Gson 的 `TypeToken`

</details>

<details>
<summary>常见误区 (5条)</summary>

- 误区：泛型是运行时机制，`x instanceof List<String>` 可行。实际擦除，运行时只有 List，泛型信息只在声明侧的 Signature 属性里。
- 误区：`List<Object>` 是 `List<String>` 的父类型，可以直接赋值。泛型不变，兼容关系必须靠通配符显式表达。
- 误区：`? extends` 既能读也能写。extends 禁写（null 除外）；super 读出来只能是 Object。
- 误区：`List`（原始类型）等价于 `List<Object>`。原始类型绕过全部泛型检查，只是兼容旧代码的裸写法，unchecked 警告就是在提醒这件事。
- 误区：泛型数组 `new List<String>[10]` 只是运行时危险。直接编译报错——数组的运行时类型检查与擦除后的伪类型冲突，放行会造成堆污染。
- 误区：泛型类的子类自动继承泛型参数。子类必须显式声明泛型参数，或指定具体类型，否则会丢失类型信息。
- 误区：`List<String>` 和 `List<Integer>` 可以相互赋值。泛型是不变的，即使 String 和 Integer 都是 Object 的子类，它们的 List 也不能互赋。

</details>
