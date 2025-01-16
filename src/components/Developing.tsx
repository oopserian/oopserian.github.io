export const Developing = () => {
    const colors = ["#3f3f46", "#27272a"]
    return (
        <div className="h-56 rounded-[inherit] inset-0 overflow-hidden opacity-60">
            <svg width="100%" height="100%">
                <defs>
                    <pattern
                        id="stripe-pattern"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                    >   
                    {
                        colors.map((color,index)=>(
                            <rect x={index * 25} width="25" height="50" fill={color} />
                        ))
                    }
                        <animateTransform
                            attributeName="patternTransform"
                            attributeType="XML"
                            type="rotate"
                            from="-30"
                            to="-30"
                            dur="2s"
                            repeatCount="indefinite"
                            additive="sum"
                        />
                        <animateTransform
                            attributeName="patternTransform"
                            attributeType="XML"
                            type="translate"
                            from="0 0"
                            to="50 0"
                            dur="2s"
                            repeatCount="indefinite"
                            additive="sum"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#stripe-pattern)" />
            </svg>
        </div>
    )
}