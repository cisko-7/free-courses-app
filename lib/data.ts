export type ItemType = "theory" | "task";

export interface TestCase {
  input: string;
  expected: string;
}

export interface CourseItem {
  id: string;
  title: string;
  type: ItemType;
  content: string;
  solution?: string;
  initialCode?: string;
  tests?: TestCase[];
}

export interface Topic {
  id: string;
  title: string;
  items: CourseItem[];
}

export interface Course {
  id: string;
  title: string;
  language: string;
  level: string;
  description: string;
  topics: Topic[];
}

export const courses: Course[] = [
  {
    id: "cpp-basics",
    title: "C++: С нуля до первого проекта",
    language: "C++",
    level: "Начинающий",
    description: "Основы C++, переменные, ввод/вывод данных, векторы и решение прикладных практических задач.",
    topics: [
      {
        id: "cpp-syntax",
        title: "Тема 1. Базовый синтаксис и ввод/вывод",
        items: [
          {
            id: "cpp-intro",
            title: "Структура программы и функция main",
            type: "theory",
            content: `# Структура программы на C++

Каждая программа на языке C++ начинается с функции \`main\`. Это главная точка входа, откуда операционная система начинает выполнение инструкций.

## Минимальная программа:
\`\`\`cpp
#include <iostream>

int main() {
    std::cout << "Привет, мир C++!" << std::endl;
    return 0;
}
\`\`\`

### Разбор кода:
- \`#include <iostream>\` — директива препроцессора, подключающая стандартную библиотеку потокового ввода-вывода.
- \`std::cout\` — стандартный поток вывода в консоль (character output).
- \`<<\` — оператор вставки данных в поток.
- \`return 0;\` — код возврата, сигнализирующий об успешном завершении программы.`,
          },
          {
            id: "cpp-vars-types",
            title: "Переменные и базовые типы данных",
            type: "theory",
            content: `# Переменные и типизация в C++

C++ — статически типизированный язык. Тип каждой переменной должен быть известен на этапе компиляции.

## Основные примитивные типы:
- \`int\` — целые числа (например, \`-42\`, \`0\`, \`100\`)
- \`double\` — вещественные числа двойной точности (\`3.14159\`)
- \`char\` — одиночный символ (\`'A'\`, \`'9'\`)
- \`bool\` — логический тип (\`true\` или \`false\`)

\`\`\`cpp
#include <iostream>

int main() {
    int score = 450;
    double accuracy = 98.5;
    bool isWinner = true;

    std::cout << "Очки: " << score << ", Точность: " << accuracy << "%" << std::endl;
    return 0;
}
\`\`\``,
          },
          {
            id: "cpp-task-calc",
            title: "Практическая задача: Площадь и периметр",
            type: "task",
            content: `# Задача: Расчёт геометрии прямоугольника

Напишите программу, которая считывает со стандартного ввода (\`std::cin\`) два целых положительных числа: стороны прямоугольника \`a\` и \`b\`, разделенные пробелом.

Вычислите **площадь** ($S = a \\times b$) и **периметр** ($P = 2 \\times (a + b)$) прямоугольника и выведите результат в консоль.

### Формат входных данных:
Одна строка, содержащая два целых числа \`a\` и \`b\`.

### Формат выходных данных:
\`\`\`text
Площадь: {S}
Периметр: {P}
\`\`\`

### Пример:
**Входные данные:**
\`\`\`text
5 8
\`\`\`

**Вывод:**
\`\`\`text
Площадь: 40
Периметр: 26
\`\`\``,
            initialCode: `#include <iostream>

int main() {
    int a, b;
    // Считайте числа a и b из входного потока:
    if (std::cin >> a >> b) {
        // Напишите формулы для площади и периметра
        // и выведите ответ в точном соответствии с форматом:
        
    }
    return 0;
}`,
            tests: [
              { input: "5 8\n", expected: "Площадь: 40\nПериметр: 26\n" },
              { input: "3 4\n", expected: "Площадь: 12\nПериметр: 14\n" },
              { input: "10 20\n", expected: "Площадь: 200\nПериметр: 60\n" },
            ],
            solution: `#include <iostream>

int main() {
    int a, b;
    if (std::cin >> a >> b) {
        int area = a * b;
        int perimeter = 2 * (a + b);
        std::cout << "Площадь: " << area << std::endl;
        std::cout << "Периметр: " << perimeter << std::endl;
    }
    return 0;
}`,
          },
        ],
      },
      {
        id: "cpp-vectors",
        title: "Тема 2. Векторы и динамические массивы",
        items: [
          {
            id: "cpp-vector-intro",
            title: "Векторы STL (std::vector)",
            type: "theory",
            content: `# Динамические массивы: std::vector

Вектор — это последовательный контейнер стандартной библиотеки C++ (STL), который автоматически управляет динамической памятью.

## Использование вектора:
\`\`\`cpp
#include <iostream>
#include <vector>

int main() {
    // Инициализация вектора
    std::vector<int> numbers = {10, 20, 30};

    // Добавление элемента в конец
    numbers.push_back(40);

    // Доступ по индексу и размер
    std::cout << "Размер: " << numbers.size() << std::endl;
    std::cout << "Первый элемент: " << numbers[0] << std::endl;

    for (int n : numbers) {
        std::cout << n << " ";
    }
    std::cout << std::endl;

    return 0;
}
\`\`\``,
          },
          {
            id: "cpp-task-vector-sum",
            title: "Практическая задача: Сумма положительных чисел",
            type: "task",
            content: `# Задача: Сумма положительных элементов вектора

Напишите программу, которая считывает количество чисел \`n\`, а затем \`n\` целых чисел. Сохраните их в динамический массив \`std::vector<int>\`, найдите сумму только **положительных** чисел (\`> 0\`) и выведите результат.

### Формат входных данных:
1. В первой строке число \`n\` (количество элементов).
2. Во второй строке \`n\` целых чисел через пробел.

### Формат выходных данных:
\`\`\`text
Сумма положительных: {sum}
\`\`\`

### Пример:
**Вход:**
\`\`\`text
6
-4 10 -2 5 0 7
\`\`\`

**Вывод:**
\`\`\`text
Сумма положительных: 22
\`\`\``,
            initialCode: `#include <iostream>
#include <vector>

int main() {
    int n;
    if (std::cin >> n) {
        std::vector<int> nums(n);
        for (int i = 0; i < n; i++) {
            std::cin >> nums[i];
        }
        
        int positiveSum = 0;
        // Обойдите вектор и просуммируйте элементы, которые больше нуля:
        
        
        std::cout << "Сумма положительных: " << positiveSum << std::endl;
    }
    return 0;
}`,
            tests: [
              { input: "6\n-4 10 -2 5 0 7\n", expected: "Сумма положительных: 22\n" },
              { input: "4\n-1 -5 -10 -2\n", expected: "Сумма положительных: 0\n" },
              { input: "5\n1 2 3 4 5\n", expected: "Сумма положительных: 15\n" },
            ],
            solution: `#include <iostream>
#include <vector>

int main() {
    int n;
    if (std::cin >> n) {
        std::vector<int> nums(n);
        int positiveSum = 0;
        for (int i = 0; i < n; i++) {
            std::cin >> nums[i];
            if (nums[i] > 0) {
                positiveSum += nums[i];
            }
        }
        std::cout << "Сумма положительных: " << positiveSum << std::endl;
    }
    return 0;
}`,
          },
        ],
      },
    ],
  },
  {
    id: "python-basics",
    title: "Python: Быстрый старт в разработку",
    language: "Python",
    level: "Начинающий",
    description: "Базовый синтаксис Python, коллекции данных, функции и интерактивное решение алгоритмических задач.",
    topics: [
      {
        id: "py-syntax",
        title: "Тема 1. Основы синтаксиса Python",
        items: [
          {
            id: "py-intro",
            title: "Знакомство с Python и переменные",
            type: "theory",
            content: `# Введение в Python

Python — высокоуровневый язык программирования с чистым и выразительным синтаксисом.

\`\`\`python
name = "DevCourses"
rating = 5.0
is_active = True

print(f"Платформа: {name}, Оценка: {rating}")
\`\`\``,
          },
          {
            id: "py-task-greeting",
            title: "Практическая задача: Персональное приветствие",
            type: "task",
            content: `# Задача: Персональное приветствие

Напишите программу, которая считывает имя пользователя и его роль (вводятся через пробел в одной строке) и выводит приветственную строку.

### Формат входных данных:
Строка с двумя словами: \`[Имя] [Роль]\`.

### Формат выходных данных:
\`\`\`text
Пользователь [ИМЯ] вошел с правами [РОЛЬ]
\`\`\`

### Пример:
**Вход:**
\`\`\`text
Алексей Admin
\`\`\`

**Вывод:**
\`\`\`text
Пользователь Алексей вошел с правами Admin
\`\`\``,
            initialCode: `import sys

def main():
    line = sys.stdin.read().strip()
    if not line:
        return
    parts = line.split()
    name = parts[0]
    role = parts[1]
    
    # Сформируйте и напечатайте строку приветствия:
    

if __name__ == "__main__":
    main()`,
            tests: [
              { input: "Алексей Admin\n", expected: "Пользователь Алексей вошел с правами Admin\n" },
              { input: "Анна Developer\n", expected: "Пользователь Анна вошел с правами Developer\n" },
              { input: "Иван Guest\n", expected: "Пользователь Иван вошел с правами Guest\n" },
            ],
            solution: `import sys

def main():
    line = sys.stdin.read().strip()
    if not line:
        return
    parts = line.split()
    name = parts[0]
    role = parts[1]
    print(f"Пользователь {name} вошел с правами {role}")

if __name__ == "__main__":
    main()`,
          },
        ],
      },
      {
        id: "py-lists",
        title: "Тема 2. Списки и циклы",
        items: [
          {
            id: "py-lists-intro",
            title: "Списки (Lists) и генераторы списков",
            type: "theory",
            content: `# Списки в Python

Списки позволяют хранить упорядоченные коллекции элементов любого типа.

\`\`\`python
fruits = ["яблоко", "банан", "апельсин"]
fruits.append("груша")

for index, fruit in enumerate(fruits, start=1):
    print(f"{index}. {fruit}")
\`\`\``,
          },
          {
            id: "py-task-filter",
            title: "Практическая задача: Чётные числа",
            type: "task",
            content: `# Задача: Выборка чётных чисел

Считайте со стандартного ввода последовательность целых чисел, разделенных пробелами. Отфильтруйте только чётные числа (\`n % 2 == 0\`) и выведите итоговый список в стандартном формате представления списков Python.

### Пример:
**Вход:**
\`\`\`text
1 2 3 4 5 6 7 8 9 10
\`\`\`

**Вывод:**
\`\`\`text
[2, 4, 6, 8, 10]
\`\`\``,
            initialCode: `import sys

def main():
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        print([])
        return
    numbers = [int(x) for x in raw_input.split()]
    
    # Отфильтруйте только четные числа и напечатайте результат:
    evens = []
    
    print(evens)

if __name__ == "__main__":
    main()`,
            tests: [
              { input: "1 2 3 4 5 6 7 8 9 10\n", expected: "[2, 4, 6, 8, 10]\n" },
              { input: "1 3 5 7 9\n", expected: "[]\n" },
              { input: "12 44 98 100\n", expected: "[12, 44, 98, 100]\n" },
            ],
            solution: `import sys

def main():
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        print([])
        return
    numbers = [int(x) for x in raw_input.split()]
    evens = [n for n in numbers if n % 2 == 0]
    print(evens)

if __name__ == "__main__":
    main()`,
          },
        ],
      },
    ],
  },
  {
    id: "cpp-algorithms",
    title: "C++: Алгоритмы и структуры данных",
    language: "C++",
    level: "Средний",
    description: "Динамические массивы, списки, алгоритмы поиска и решение классических олимпиадных задач.",
    topics: [
      {
        id: "algo-searching",
        title: "Тема 1. Алгоритмы поиска",
        items: [
          {
            id: "algo-linear-binary",
            title: "Линейный и бинарный поиск",
            type: "theory",
            content: `# Алгоритмы поиска

Бинарный поиск работает за время $O(\\log N)$, но требует предварительно отсортированного массива.

\`\`\`cpp
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> data = {1, 3, 5, 7, 9, 11};
    bool found = std::binary_search(data.begin(), data.end(), 7);
    std::cout << "Найдено: " << (found ? "Да" : "Нет") << std::endl;
    return 0;
}
\`\`\``,
          },
          {
            id: "algo-task-max",
            title: "Практическая задача: Поиск максимума",
            type: "task",
            content: `# Задача: Поиск максимального элемента

Напишите программу, которая считывает число \`n\` (размер массива) и затем \`n\` целых чисел. Найдите максимальный элемент без использования функции \`std::max_element\`.

### Формат выходных данных:
\`\`\`text
Максимум: {max}
\`\`\`

### Пример:
**Вход:**
\`\`\`text
5
15 3 42 8 23
\`\`\`

**Вывод:**
\`\`\`text
Максимум: 42
\`\`\``,
            initialCode: `#include <iostream>
#include <vector>

int main() {
    int n;
    if (std::cin >> n && n > 0) {
        std::vector<int> nums(n);
        for (int i = 0; i < n; i++) {
            std::cin >> nums[i];
        }
        
        // Найдите максимум без std::max_element:
        int maxVal = nums[0];
        
        std::cout << "Максимум: " << maxVal << std::endl;
    }
    return 0;
}`,
            tests: [
              { input: "5\n15 3 42 8 23\n", expected: "Максимум: 42\n" },
              { input: "4\n-10 -5 -2 -20\n", expected: "Максимум: -2\n" },
              { input: "3\n100 100 99\n", expected: "Максимум: 100\n" },
            ],
            solution: `#include <iostream>
#include <vector>

int main() {
    int n;
    if (std::cin >> n && n > 0) {
        std::vector<int> nums(n);
        for (int i = 0; i < n; i++) {
            std::cin >> nums[i];
        }
        int maxVal = nums[0];
        for (int i = 1; i < n; i++) {
            if (nums[i] > maxVal) {
                maxVal = nums[i];
            }
        }
        std::cout << "Максимум: " << maxVal << std::endl;
    }
    return 0;
}`,
          },
        ],
      },
    ],
  },
];

// Helper to flatten all items in course
export function getAllCourseItems(course: Course) {
  return course.topics.flatMap((topic) =>
    topic.items.map((item) => ({
      ...item,
      topicId: topic.id,
      topicTitle: topic.title,
    }))
  );
}

// Helper to calculate total items count
export function getTotalItemsCount(course: Course): number {
  return course.topics.reduce((sum, topic) => sum + topic.items.length, 0);
}
