import { LabCard } from "@/components/LabCard";
import { ProjectCard } from "@/components/ProjectCard";
import projectData from "@/data/projects/data.json";
import labData from "@/data/labs/data.json";
import { IconBrandX, IconBrandGithub, IconMail } from "@tabler/icons-react";
import { Gradient } from "@/lib/Gradient.js";
import { useEffect } from "react";

const Layout: React.FC = () => {
    return (
        <>
            <main className="flex flex-col gap-8 py-10 px-5 w-full max-w-screen-md mx-auto">
                {/* <Bg /> */}
                <GradientBg />
                <MineInfos />
                <Projects />
                <Lab />
            </main>
        </>
    )
};

const GradientBg = () => {
    useEffect(() => {
        const gradient = new Gradient();
        gradient.initGradient('#gradient-canvas');
    }, []);
    const style: any = {
        "--gradient-color-1": "#043D5D",
        "--gradient-color-2": "#032E46",
        "--gradient-color-3": "#23B684",
        "--gradient-color-4": "#0F595E",
    };
    return (
        <div className="fixed w-full h-2/3 top-0 left-0 opacity-40 pointer-events-none">
            <span className="absolute w-full h-full top-0 left-0 bg-gradient-to-b from-transparent to-[#09090b]"></span>
            <canvas style={style} className="w-full h-full" id="gradient-canvas"></canvas>
        </div>
    )
}

// const Bg = () => {
//     return (
//         <div className="fixed w-[60vw] h-[60vw] left-1/4 -top-10 blur-2xl overflow-hidden">
//             <p className="w-1/3 h-1/3 rounded-full bg-gradient-to-br from-sky-500 to-sky-400/2 opacity-40 blur-2xl animate-pulse"></p>
//             <p style={{ transform: 'rotate3d(1,1,1,230deg)' }} className="absolute -top-1/3 -left-1/3 w-full h-full rounded-full border-[300px] border-sky-400 opacity-30"></p>
//         </div>
//     )
// }

const MineInfos = () => {
    return (
        <div className="animation-fadeIn !animation-delay-100 relative flex flex-col gap-8">
            <a target="_blank" href="https://github.com/oopserian" className="border border-zinc-50 block w-12 h-12 rounded-full overflow-hidden bg-gradient-to-t from-zinc-50 to-green-50">
                <img className="w-full h-full object-cover" src="/logo.webp" />
            </a>
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold leading-none">Web & Software Developer</h2>
                <p className="text-md font-thin text-zinc-400 leading-none">Build Stuff. Sometimes It Works.</p>
                <div className="flex items-center gap-2">
                    <a className="opacity-50 hover:opacity-100 transition-[transform,opacity] hover:-rotate-12 hover:scale-110" href="https://x.com/oopserian" target="_blank">
                        <IconBrandX size={20} />
                    </a>
                    <a className="opacity-50 hover:opacity-100 transition-[transform,opacity] hover:rotate-6 hover:scale-110" href="https://github.com/oopserian" target="_blank">
                        <IconBrandGithub size={20} />
                    </a>
                    <a className="opacity-50 hover:opacity-100 transition-[transform,opacity] hover:-rotate-6 hover:scale-110" href="mailto:oopserian@gmail.com" target="_blank">
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
        <div className="animation-fadeIn !animation-delay-200 flex flex-col gap-2.5">
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
        <div className="animation-fadeIn !animation-delay-300 flex flex-col gap-2.5">
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