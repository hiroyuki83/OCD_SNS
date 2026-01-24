import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RightSection() {
    return (
        <div className="hidden lg:flex flex-col gap-4 w-[350px] px-4 sticky top-0 h-screen overflow-y-auto py-2 border-l border-border">
            {/* Search Bar */}
            <div className="sticky top-0 bg-background z-10 pb-2 pt-1">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#1d9bf0]">
                        <Search className="h-5 w-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search"
                        className="block w-full pl-10 bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:bg-background"
                    />
                </div>
            </div>

            {/* Subscribe Card */}
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2 border border-border">
                <h2 className="text-xl font-bold">Subscribe to Premium</h2>
                <p className="text-sm font-light">
                    Subscribe to unlock new features and if eligible, receive a share of ads revenue.
                </p>
                <Button className="rounded-full bg-[#1d9bf0] hover:bg-[#1a8cd8] w-fit px-5 font-bold">
                    Subscribe
                </Button>
            </div>

            {/* Trends Card */}
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl pt-4 border border-border">
                <h2 className="text-xl font-bold px-4 mb-4">What's happening</h2>
                <div className="flex flex-col">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="px-4 py-3 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <div className="flex justify-between text-xs text-zinc-500">
                                <span>Trending in Japan</span>
                                <span>...</span>
                            </div>
                            <p className="font-bold text-sm">Trend Topic #{i}</p>
                            <span className="text-xs text-zinc-500">12.5K posts</span>
                        </div>
                    ))}
                    <div className="p-4 text-[#1d9bf0] text-sm cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-b-2xl">
                        Show more
                    </div>
                </div>
            </div>

            {/* Who to follow Card */}
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl pt-4 border border-border">
                <h2 className="text-xl font-bold px-4 mb-4">Who to follow</h2>
                <div className="flex flex-col">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="px-4 py-3 flex items-center justify-between hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-slate-400"></div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm hover:underline">User {i}</span>
                                    <span className="text-zinc-500 text-sm">@user{i}</span>
                                </div>
                            </div>
                            <Button variant="outline" className="rounded-full font-bold h-8 border-border">Follow</Button>
                        </div>
                    ))}
                    <div className="p-4 text-[#1d9bf0] text-sm cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-b-2xl">
                        Show more
                    </div>
                </div>
            </div>
        </div>
    );
}
