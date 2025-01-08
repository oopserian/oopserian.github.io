import React, { lazy, Suspense } from "react";
import { IconBrandGithub } from "@tabler/icons-react";

interface LabCardProps {
    data: Lab
}

export const LabCard: React.FC<LabCardProps> = ({ data }) => {
    let { name, en_title, tags } = data;
    const Container = lazy(() => import(`@/data/labs/${name}/page.tsx`));

    const toGithub = () => {
        window.open('https://github.com/oopserian/oopserian.github.io/tree/main/src/data/labs/' + name);
    };

    return (
        <Suspense>
            <div id={name} className="flex flex-col gap-2 bg-zinc-950 border-zinc-800 border rounded-2xl overflow-hidden p-2 transition-[border-color] hover:border-zinc-700">
                <div className="flex-1 min-h-12 rounded-xl bg-zinc-900">
                    <Container />
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 p-1 font-normal">
                        <p className="text-zinc-200 text-sm">{en_title}</p>
                        <div className="flex gap-1">
                            {
                                tags.map(tag => (
                                    <Tag key={tag} name={tag} />
                                ))
                            }
                        </div>
                    </div>
                    <div className="cursor-pointer">
                        <IconBrandGithub onClick={toGithub} size={20} stroke={1} />
                    </div>
                </div>
            </div>
        </Suspense>
    )
};


const Tag: React.FC<{ name: string }> = ({ name }) => {
    return (
        <div className="text-zinc-500 text-xs font-light px-2 py-0.5 bg-zinc-900 rounded-md">
            {name}
        </div>
    )
}