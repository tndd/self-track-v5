import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'しずく — 体調の記録',description:'その時の体調と一日の総括を分けて残す、日々の記録。',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},robots:{index:false,follow:false},appleWebApp:{capable:true,title:'しずく'}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#101e30'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ja"><body>{children}</body></html>; }
