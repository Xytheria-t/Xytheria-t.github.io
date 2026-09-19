---
title: Java 泛型
category: javase
aliases: [泛型, 泛型擦除, generics]
---

# Java 泛型

Java 泛型是一种编译期的类型参数化机制：把「容器或方法操作什么类型」写成类型参数 `<T>` 交给编译器，由它检查类型、在使用处插入强转。类型参数只活在编译期、运行期被擦除，所以 `List<String>` 与 `List<Integer>` 是同一个类。

## 思维链路速查

```chain
为什么需要泛型 | 检查前移到编译期 | 动机
泛型语法速查 | 类/方法/边界 | 速查
类型擦除 | 运行时的真相 | 核心
通配符与 PECS | 读写方向 | 难点
面试问答 | 高频考点 | 复盘
```

泛型的全部内容围绕一次「搬家」：类型检查从运行时搬到编译期，靠**擦除**实现——编译完类型参数就没了，只剩 Object 与编译器插入的强转。立住这条真相，PECS 就是推论而不是口诀。

## 为什么需要泛型

| 对比维度 | 无泛型 | 泛型 |
|---|---|---|
| **类型检查** | 运行时抛 `ClassCastException` | 编译期报错 |
| **取值方式** | `(String) list.get(0)` | 直接使用 |
| **安全性** | 装错类型运行时才炸 | 错误拦在编译期 |

- 类型参数只能是引用类型：`List<int>` 编译不过——擦除后要替换成 Object，int 不是 Object 的子类；基本类型走包装类，装箱见 [[基本数据类型]]。
- 泛型最大的用户是集合：`List` / `Map` / `Set` 的元素类型声明全靠它兜底，接口形状见 [[Java Collection]]。

## 泛型语法速查

| 形态 | 写法 | 说明 |
|---|---|---|
| 泛型类 | `class Box<T> { T value; }` | T 随对象确定 |
| 泛型接口 | `interface Comparable<T>` | 实现类指定 T |
| 泛型方法 | `<T> T first(List<T> list)` | T 由实参推断 |
| 类型边界 | `<T extends Comparable<T>>` | T 限定为上界的子类型 |
| 原始类型 | `List list = new ArrayList()` | 裸类型，绕过泛型检查 |

| 字母 | 含义 | 典型位置 |
|---|---|---|
| T | Type，类型 | 通用占位 |
| E | Element，元素 | List、Set |
| K / V | Key / Value | Map |
| R | Return，返回值 | 方法返回类型 |
| ? | 未知类型 | 通配符 |

> [!warning] 边界只写 extends
> 没有 `<T implements X>`：上界无论写类还是接口都用 `extends`，多上界用 `&` 连接——`<T extends Comparable<T> & Serializable>`，且 `&` 之后只准接接口、类至多一个并必须排第一。类型参数只有上界，`super` 只出现在通配符里。

## 类型擦除

擦除 = 编译器生成字节码时丢掉类型参数、换成上界（没写上界就是 Object），并在使用处自动插入强转——因此 `List<String>` 与 `List<Integer>` 运行时是**同一个 Class**。

```java
List<String> list = new ArrayList<>();  // 你写的
list.add("hi");
String s = list.get(0);

List list = new ArrayList();        // 擦除后：<String> 没了
list.add("hi");                     // 实际签名 add(Object)
String s = (String) list.get(0);    // 编译器自动插入的强转
```

推论（均编译期拦截）：

| 限制写法 | 原因 |
|---|---|
| `new T()` ❌ | 运行时不知道 T 是谁 |
| `new T[10]` ❌ | 擦除后无类型可查 |
| `x instanceof List<String>` ❌ | 运行时只有 List |
| `T.class` ❌ | 类型参数不是运行时实体 |
| `static T x` ❌ | 静态字段需随 T 各存一份 |

> [!note] 擦除是「半擦」：擦的是「用」，留的是「声明」
> - **擦掉的**：对象身上的类型参数——`new ArrayList<String>()` 运行时就是裸 ArrayList，`getClass()` 只问得出 `ArrayList`，上表的禁写全由此而来。
> - **留底的**：声明处的泛型进 class 文件的 Signature 属性——类头（`extends Box<String>`）、字段、方法签名都算，反射 `getGenericSuperclass()` / `getGenericType()` 读的就是它；JSON 库 `new TypeReference<List<User>>() {}` 能拿到 `List<User>`，靠匿名子类类头记死了父类类型参数。

## 通配符与 PECS

PECS（Producer Extends, Consumer Super）是通配符选型口诀，前提是**泛型不变**：`String` 是 `Object` 子类，但 `List<String>` 与 `List<Object>` 之间没有子类型关系（`List<Object> o = new ArrayList<String>()` 编译错）。

| 对比维度 | 数组 | 泛型 |
|---|---|---|
| **子类型** | 协变：`String[]` → `Object[]` | 不变：`List<String>` ≠ `List<Object>` |
| **类型检查** | 运行时 | 编译期 |

| 通配符 | 含义 | 可写 | 可读 |
|---|---|---|---|
| `? extends T` | T 或其子类 | ❌ | ✅ 按 T |
| `? super T` | T 或其父类 | ✅ T 及其子类 | ❌ 仅 Object |
| `?` | 未知类型 | ❌ | ❌ 仅 Object |

> [!warning] 读写不对称的根源
> 通配符只约定「某个未知类型」：extends 视角下写入任何具体类都可能撞上实际类型，编译器干脆禁写（只有 `null` 除外）；super 视角下写 Integer 及其子类一定合法，读出来却只知道是 Object。

```branch
01: 选择通配符
02: 按数据流向分流
- 只读 | extends | 生产者 Producer
- 只写 | super | 消费者 Consumer
- 又读又写 | 精确类型 | 不用通配符
```

## 落地：易错点代码

```java
List raw = new ArrayList<String>();   // 原始类型：unchecked 警告的来源
raw.add(42);                          // 混入 Integer，无人拦
String s = (String) raw.get(0);       // ClassCastException，运行时才炸

Object[] arr = new String[]{"x"};
arr[0] = 42;                          // ArrayStoreException：数组协变运行时才炸
```

<details>
<summary>面试问答 (4题)</summary>

Q：什么是类型擦除？为什么这么设计？

A：编译器把类型参数换成上界（无上界则 Object）并自动插强转；目的是二进制兼容——旧类库无需重编译即可与泛型代码互操作，代价是运行时拿不到类型参数。

Q：泛型信息完全丢失了吗？JSON 库怎么拿到 `List<User>`？

A：没全丢。声明侧（类继承、方法签名、字段）的泛型进 class 文件的 Signature 属性，反射 `getGenericSuperclass()` 可读；`new TypeReference<List<User>>() {}` 靠匿名子类把类型钉在声明侧——拿不到的只是运行中对象的类型参数。

Q：PECS 是什么？

A：Producer Extends, Consumer Super——只读容器用 `? extends T`，只写容器用 `? super T`，又读又写用精确类型。范例：`Collections.copy(List<? super T> dest, List<? extends T> src)`，一个签名把 PECS 用全。

Q：桥方法是什么？

A：擦除让实现与接口的签名不一致：实现 `Comparable<String>` 写 `compareTo(String)`，接口擦除后要求 `compareTo(Object)`；编译器自动生成桥方法转发到实现，多态才不中断。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：泛型是运行时机制，`x instanceof List<String>` 可行。运行时只有 List，泛型信息只在声明侧的 Signature 属性里，不在对象上。
- 误区：`List`（原始类型）等价于 `List<Object>`。原始类型绕过全部泛型检查，只是兼容旧代码的裸写法，unchecked 警告就在提醒这件事。
- 误区：泛型数组 `new List<String>[10]` 只是运行时危险。直接编译报错——数组的运行时类型检查与擦除后的伪类型冲突，放行会造成堆污染。

</details>
