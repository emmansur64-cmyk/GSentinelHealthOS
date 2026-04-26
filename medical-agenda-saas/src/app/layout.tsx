import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ReactQueryProvider } from "@/components/react-query-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GSentinelHealth OS",
  description: "Clinical Scheduling & Patient Flow System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="sanitize-extension-body-attrs" strategy="beforeInteractive">
          {`(function(){
            function cleanInjectedAttrs(root){
              if(!root || !root.querySelectorAll) return;
              var nodes = root.querySelectorAll('[bis_skin_checked],[bis_register],[__processed_0f8ad2f8-cf58-4f8d-a277-53f1bc7bcc65__]');
              for(var n=0;n<nodes.length;n++){
                var node = nodes[n];
                if(node.hasAttribute('bis_skin_checked')) node.removeAttribute('bis_skin_checked');
                if(node.hasAttribute('bis_register')) node.removeAttribute('bis_register');
                var names = node.getAttributeNames ? node.getAttributeNames() : [];
                for(var j=0;j<names.length;j++){
                  if(names[j].indexOf('__processed_')===0){
                    node.removeAttribute(names[j]);
                  }
                }
              }
            }

            function cleanBodyAttrs(){
              var body = document.body;
              if(!body) return;
              if(body.hasAttribute('bis_register')) body.removeAttribute('bis_register');
              if(body.hasAttribute('bis_skin_checked')) body.removeAttribute('bis_skin_checked');
              var attrs = body.getAttributeNames();
              for(var i=0;i<attrs.length;i++){
                if(attrs[i].indexOf('__processed_')===0){
                  body.removeAttribute(attrs[i]);
                }
              }
              cleanInjectedAttrs(document);
            }

            function watchMutations(){
              if(typeof MutationObserver === 'undefined') return;
              var observer = new MutationObserver(function(){
                cleanBodyAttrs();
              });
              observer.observe(document.documentElement, {
                subtree: true,
                attributes: true,
                childList: true,
                attributeFilter: ['bis_skin_checked','bis_register']
              });
              setTimeout(function(){ observer.disconnect(); }, 8000);
            }

            cleanBodyAttrs();
            document.addEventListener('readystatechange', cleanBodyAttrs);
            document.addEventListener('DOMContentLoaded', cleanBodyAttrs);
            watchMutations();
          })();`}
        </Script>
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-slate-100">
        <ReactQueryProvider>{children}</ReactQueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
