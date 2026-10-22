import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "../components/PwaRegister";

export const metadata: Metadata = {
  title: "خاندان نجف - شجره‌نامه هوشمند بی‌کران",
  description: "سامانه شجره‌نامه خاندان نجف — میراث خانواده با حریم خصوصی هوشمند",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="light h-full w-full overflow-hidden select-none" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b6b63" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* FontAwesome Icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          precedence="default"
        />
      </head>
      <body className="h-full w-full overflow-hidden flex flex-col antialiased bg-neo-bg">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
