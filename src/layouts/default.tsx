import { LabCard } from "@/components/LabCard";
import { ProjectCard } from "@/components/ProjectCard";
import projectData from "@/data/projects/data.json";
import labData from "@/data/labs/data.json";
import { IconBrandX, IconBrandGithub, IconMail } from "@tabler/icons-react";

const Layout: React.FC = () => {
    return (
        <>
            <main className="flex flex-col gap-8 py-10 px-5 w-full max-w-screen-md mx-auto">
                <Bg />
                <MineInfos />
                <Projects />
                <Lab />
            </main>
        </>
    )
};

const Bg = () => {
    return (
        <div className="fixed w-[60vw] h-[60vw] left-1/4 -top-10 blur-2xl">
            <p className="w-1/3 h-1/3 rounded-full bg-gradient-to-br from-sky-500 to-sky-400/2 opacity-40 blur-2xl"></p>
            <p style={{ transform: 'rotate3d(1,1,1,230deg)' }} className="absolute -top-1/3 -left-1/3 w-full h-full rounded-full border-[300px] border-sky-400 opacity-30"></p>
        </div>
    )
}

const MineInfos = () => {
    return (
        <div className="relative flex flex-col gap-8">
            <a target="_blank" href="https://github.com/oopserian" className="border border-zinc-50 block w-12 h-12 rounded-full overflow-hidden bg-gradient-to-t from-zinc-50 to-green-50">
                <img className="w-full h-full object-cover" src="/logo.webp" />
            </a>
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold leading-none">Web & software developer</h2>
                <p className="text-md font-thin text-zinc-400 leading-none">Building is My Passion!</p>
                <div className="flex items-center gap-2">
                    <a className="opacity-50 hover:opacity-100 transition-opacity" href="https://x.com/oopserian" target="_blank">
                        <IconBrandX size={20} />
                    </a>
                    <a className="opacity-50 hover:opacity-100 transition-opacity" href="https://github.com/oopserian" target="_blank">
                        <IconBrandGithub size={20} />
                    </a>
                    <a className="opacity-50 hover:opacity-100 transition-opacity" href="mailto:oopserian@gmail.com" target="_blank">
                        <IconMail size={20} />
                    </a>
                </div>
            </div>
        </div>
    )
};

const Projects = () => {
    const projectDataList = Object.values(projectData);
    return (
        <div className="flex flex-col gap-2.5">
            <h2 className="text-xl font-bold">Projects</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
                {
                    projectDataList.map(project => (
                        !project.hide && <ProjectCard key={project.name} logo={project.cover} name={project.name} description={project.description} link={project.url} />
                    ))
                }
            </div>
        </div>
    )
};

const Lab = () => {
    const labDataList = Object.values(labData);
    return (
        <div className="flex flex-col gap-2.5">
            <h2 className="text-xl font-bold">Lab</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
                {
                    labDataList.map(lab => (
                        <LabCard key={lab.name} data={lab} />
                    ))
                }
            </div>
        </div>
    )
};


export {
    Layout
}