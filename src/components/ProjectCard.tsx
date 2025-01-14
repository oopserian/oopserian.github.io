import { cn } from "@/lib/utils";
import { HoverMotion } from "./HoverMotion";
// import { IconBrandGithub } from "@tabler/icons-react";

interface ProjectCardProps {
    logo: string,
    name: string,
    description: string,
    link?: string
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ logo, name, description, link }) => {
    const jumpLink = () => {
        window.open(link);
    };

    return (
        <HoverMotion.Root>
            <HoverMotion.Tilt strength={{
                x: 0.4,
                y: 1
            }} onClick={jumpLink} className={cn(
                "group p-3 border bg-zinc-900 border-zinc-800 rounded-2xl select-none",
                (link ? "cursor-pointer" : "")
            )}>
                <HoverMotion.Magnetic strength={{
                    x: 0.25,
                    y: 0.25
                }} className="relative flex gap-2 items-center">
                    <img className="pointer-events-none absolute h-full scale-150 w-auto top-0 -left-2 blur-lg opacity-0 transition-opacity group-hover:opacity-50" src={logo} />
                    <img className="relative w-14 h-14" src={logo} />
                    <div className="flex-1">
                        <p className="text-sm font-bold">{name}</p>
                        <p className="text-xs font-thin text-zinc-400">{description}</p>
                    </div>
                    <div>
                        {/* <IconBrandGithub size={20} stroke={1} /> */}
                    </div>
                </HoverMotion.Magnetic>
            </HoverMotion.Tilt>
        </HoverMotion.Root>
    )
}