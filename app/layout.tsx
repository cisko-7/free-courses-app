import type { Metadata, Viewport } from "next";
import { Onest, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";

const sans = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Serif нужен только для сертификата — не блокируем первую отрисовку его предзагрузкой
const serif = Lora({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

// Статический экспорт не умеет отдавать HTTP-заголовки, поэтому CSP задаётся через <meta>.
// (frame-ancestors через meta не работает — для защиты от iframe нужны заголовки хостинга.)
const originOf = (url?: string) => {
  try {
    return new URL(url ?? "").origin;
  } catch {
    return "";
  }
};
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const runOrigin = originOf(process.env.NEXT_PUBLIC_RUN_URL);
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // Next.js inline-скрипты + Monaco
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  // TODO: уберите emkc.org, когда lib/executor.ts перейдёт на NEXT_PUBLIC_RUN_URL
  `connect-src 'self' ${[supabaseOrigin, runOrigin, "https://cdn.jsdelivr.net", "https://emkc.org", "https://api.emailjs.com"].filter(Boolean).join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const siteTitle = "DevCourses — интерактивные курсы по программированию";
const siteDescription =
  "Изучай C++ и Python, решая задачи прямо в браузере: теория, редактор кода, автопроверка тестов и именные сертификаты.";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: siteTitle, template: "%s · DevCourses" },
  description: siteDescription,
  applicationName: "DevCourses",
  manifest: "/manifest.json",
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "DevCourses",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: { card: "summary", title: siteTitle, description: siteDescription },
  // Админка и служебные маршруты не должны попадать в поисковую выдачу
  robots: { index: true, follow: true },
};

// В Next.js 14+ themeColor в metadata устарел — он задаётся через viewport
export const viewport: Viewport = {
  themeColor: "#2563eb",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={`dark scroll-smooth ${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <head>
        {process.env.NODE_ENV === "production" && (
          <meta httpEquiv="Content-Security-Policy" content={csp} />
        )}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Перейти к содержимому
        </a>
        <div aria-hidden="true" className="bg-ambient" />
        {/* Шапка и навигация живут внутри страниц: раньше здесь была вторая,
            дублирующая шапка, а её ссылки /#dashboard ничего не делали. */}
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
