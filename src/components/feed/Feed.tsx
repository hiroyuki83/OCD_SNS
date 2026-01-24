export default function Feed() {
    return (
        <div className="flex-1 border-r border-border min-h-screen">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border">
                <div className="flex h-14">
                    {/* Tabs */}
                    <div className="flex-1 flex items-center justify-center hover:bg-zinc-200/20 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors relative">
                        <span className="font-bold text-sm">For you</span>
                        <div className="absolute bottom-0 w-14 h-1 bg-[#1d9bf0] rounded-full"></div>
                    </div>
                    <div className="flex-1 flex items-center justify-center hover:bg-zinc-200/20 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors text-zinc-500">
                        <span className="font-medium text-sm">Following</span>
                    </div>
                </div>
            </div>

            {/* Tweet Input Area (Mock) */}
            <div className="p-4 border-b border-border flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0"></div>
                <div className="flex-1 flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="What is happening?!"
                        className="bg-transparent text-xl outline-none placeholder:text-zinc-500"
                    />
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex gap-2 text-[#1d9bf0]">
                            {/* Icons mock */}
                            <div className="w-5 h-5 rounded hover:bg-[#1d9bf0]/10 cursor-pointer"></div>
                            <div className="w-5 h-5 rounded hover:bg-[#1d9bf0]/10 cursor-pointer"></div>
                        </div>
                        <button className="bg-[#1d9bf0] text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-[#1a8cd8] disabled:opacity-50">
                            Post
                        </button>
                    </div>
                </div>
            </div>

            {/* Feed List */}
            <div className="flex flex-col">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="p-4 border-b border-border hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors cursor-pointer flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm">
                                <span className="font-bold">User Name</span>
                                <span className="text-zinc-500">@handle</span>
                                <span className="text-zinc-500">·</span>
                                <span className="text-zinc-500">2h</span>
                            </div>
                            <p className="text-sm">
                                This is a sample tweet #{i}. Creating an X clone with Next.js is fun! #NextJS #WebDev
                            </p>
                            <div className="flex justify-between mt-3 text-zinc-500 max-w-md">
                                <div className="flex items-center gap-2 group hover:text-[#1d9bf0]">
                                    <span className="group-hover:bg-[#1d9bf0]/10 p-2 rounded-full -ml-2 transition-colors">💬</span>
                                    <span className="text-xs">20</span>
                                </div>
                                <div className="flex items-center gap-2 group hover:text-green-500">
                                    <span className="group-hover:bg-green-500/10 p-2 rounded-full -ml-2 transition-colors">RT</span>
                                    <span className="text-xs">5</span>
                                </div>
                                <div className="flex items-center gap-2 group hover:text-pink-500">
                                    <span className="group-hover:bg-pink-500/10 p-2 rounded-full -ml-2 transition-colors">❤️</span>
                                    <span className="text-xs">100</span>
                                </div>
                                <div className="flex items-center gap-2 group hover:text-[#1d9bf0]">
                                    <span className="group-hover:bg-[#1d9bf0]/10 p-2 rounded-full -ml-2 transition-colors">📊</span>
                                    <span className="text-xs">1.5K</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
