import { LabCard } from "@/components/LabCard";
import { ProjectCard } from "@/components/ProjectCard";
import projectData from "@/data/projects/data.json";
import labData from "@/data/labs/data.json";

const Layout: React.FC = () => {
    return (
        <>
            <main className="flex flex-col gap-8 py-10 px-5 w-full max-w-screen-md mx-auto">
                <p className="fixed w-1/4 min-w-40 h-1/4 rounded-full bg-green-400 -top-32 -ml-32 blur-3xl opacity-25"></p>
                <MineInfos />
                <Projects />
                <Labs />
            </main>
        </>
    )
};

const MineInfos = () => {
    return (
        <div className="relative flex flex-col gap-8">
            <a target="_blank" href="https://github.com/oopserian" className="border border-zinc-50 block w-12 h-12 rounded-full overflow-hidden bg-gradient-to-t from-zinc-50 to-green-50">
                <img className="w-full h-full object-cover" src="/logo.webp" />
            </a>
            <div>
                <h2 className="text-2xl font-bold">Web & software developer</h2>
                <p className="text-md font-thin text-zinc-400">Building is My Passion!</p>
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

const Labs = () => {
    const labDataList = Object.values(labData);
    return (
        <div className="flex flex-col gap-2.5">
            <h2 className="text-xl font-bold">Labs</h2>
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