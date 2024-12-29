import avatar from "@/assets/avatar.webp";

export const Layout: React.FC = () => {
    return (
        <>
            <header>

            </header>
            <main className="flex flex-col gap-8 py-10 px-5 w-full max-w-screen-md mx-auto">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-50">
                    <img className="w-full h-full object-cover" src={avatar} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Web & software developer</h2>
                    <p className="text-md font-thin text-zinc-400">Focused on delivering aesthetic and functional visual experiences.</p>
                </div>
                <div className="flex flex-col gap-2.5">
                    <h2 className="text-xl font-bold">Project</h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
                        <div className="relative overflow-hidden flex gap-2 items-center p-3 border border-zinc-800 rounded-2xl">
                            <img className="absolute h-full w-auto top-0 -left-2 blur-lg opacity-50" src="/logos/eterm.png" />
                            <img className="relative w-14 h-14" src="/logos/eterm.png" />
                            <div>
                                <p className="text-sm font-bold">Eterm</p>
                                <p className="text-xs font-thin trext-zinc-400">一款多控终端软件</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <footer>

            </footer>
        </>
    )
};