import Link from "next/link";
import { Home, Search, Bell, Mail, User, PenTool, Hash, FileText, Bookmark, Users, MoreHorizontal, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/auth";

export default async function Sidebar() {
  const session = await auth();
  const navItems = [
    { label: "Home", icon: Home, href: "/" },
    { label: "Explore", icon: Search, href: "/explore" },
    { label: "Notifications", icon: Bell, href: "/notifications" },
    { label: "Messages", icon: Mail, href: "/messages" },
    { label: "Lists", icon: FileText, href: "/lists" },
    { label: "Bookmarks", icon: Bookmark, href: "/bookmarks" },
    { label: "Communities", icon: Users, href: "/communities" },
    { label: "Premium", icon: Hash, href: "/premium" },
    { label: "Profile", icon: User, href: "/profile" },
    { label: "More", icon: MoreHorizontal, href: "/more" },
  ];

  return (
    <div className="flex flex-col justify-between h-screen w-[275px] px-2 sticky top-0 border-r border-border max-xl:w-20">
      <div className="flex flex-col gap-2 mt-1">
        <Link href="/" className="p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 dark:fill-white fill-black r-4qtxqj r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-18jsvk2 r-16y2uox r-8kz0gk">
            <g>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
            </g>
          </svg>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-4 p-3 w-fit rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors"
            >
              <item.icon className="w-7 h-7" />
              <span className="text-xl font-normal hidden xl:block">{item.label}</span>
            </Link>
          ))}
        </nav>
        <Button className="w-full h-14 rounded-full text-lg font-bold mt-4 bg-[#1d9bf0] hover:bg-[#1a8cd8] hidden xl:block">
          Post
        </Button>
        <Button className="w-12 h-12 rounded-full p-0 flex items-center justify-center bg-[#1d9bf0] hover:bg-[#1a8cd8] xl:hidden mt-4 mx-auto">
          <PenTool className="w-6 h-6" />
        </Button>
      </div>

      <div className="mb-4">
        {session?.user ? (
             <div className="flex items-center justify-between gap-2">
                 <button className="flex items-center gap-3 p-3 flex-1 rounded-full hover:bg-zinc-900/10 dark:hover:bg-zinc-800 transition-colors text-left overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0"></div>
                    <div className="flex-1 hidden xl:block overflow-hidden">
                        <p className="font-bold text-sm truncate">{session.user.name}</p>
                        <p className="text-zinc-500 text-sm truncate">{session.user.email}</p>
                    </div>
                </button>
                <form action={async () => {
                    "use server"
                    await signOut()
                }}>
                    <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-500 hidden xl:flex">
                        <LogOut className="w-5 h-5"/>
                    </Button>
                </form>
             </div>
        ) : (
            <div className="flex flex-col gap-2 p-2">
                 <Link href="/login">
                    <Button variant="outline" className="w-full rounded-full font-bold">Log in</Button>
                 </Link>
                 <Link href="/register">
                    <Button className="w-full rounded-full font-bold bg-white text-black hover:bg-zinc-200">Sign up</Button>
                 </Link>
            </div>
        )}
       
      </div>
    </div>
  );
}
